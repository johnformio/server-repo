'use strict';

const onFinished = require('on-finished');
const url = require('url');
const moment = require('moment');
const NodeCache = require('node-cache');
const debug = require('debug')('formio:usageTracking');

const {ensureValueIsString, determineRequestUsageType} = require('./util');

const TTL = process.env.USAGE_CACHE_TTL || 60;

class UsageTracking {
  constructor(formio) {
    this._cache = new NodeCache({stdTTL: TTL});
    // store the pointers we'll need
    this._db = formio.formio.mongoose.connection.db;
    this._formModel = formio.formio.resources.form.model;
    this._projectCache = formio.formio.cache;
    this._plans = formio.formio.plans;
  }

  async _getCurrentFormCount(projectId) {
    return this._formModel.countDocuments({project: projectId, deleted: {$eq: null}});
  }

  async getCountOfNewForms(projectId, template) {
    const forms = await this._formModel.find({project: projectId, deleted: {$eq: null}});

    return Object.keys(template)
      .filter(formName => !forms.find(form => form.name === formName))
      .length;
  }

  /**
   * Aggregate the number of requests made by type for the given project and time range.
   *
   * @param project {string}
   *   The Project Id to search for.
   * @param startDate {Date}
   *   (Optional) The start date for the query, should be a JavaScript Date object. Defaults to the beginning of the current month.
   * @param endDate {Date}
   *   (Optional) The start date for the query, should be a JavaScript Date object. Defaults to the end of the current month.
   */
  async _aggregateFromDbAndSetCache(projectId, queryStart, queryEnd) {
    const formCount = await this._getCurrentFormCount(projectId);
    const aggCursor = this._db.collection('usage').aggregate([
      {
        $match: {
          timestamp: {
            $gte: queryStart,
            $lte: queryEnd
          },
          "metadata.project": projectId
        }
      },
      {
        $group: {
          _id: "$type",
          count: {$sum: 1}
        }
      },
    ]);

    const usageMetricsByRequestType = await aggCursor.toArray();
    const usageMetrics = usageMetricsByRequestType.reduce((acc, curr) => {
      acc[curr._id] += curr.count;
      return acc;
    }, {
      submissionRequests: 0,
      formRequests: 0,
      pdfDownloads: 0,
      emails: 0,
      forms: formCount
    });
    const validatedProjectIdKey = ensureValueIsString(projectId);
    this._cache.set(validatedProjectIdKey, usageMetrics);

    return usageMetrics;
  }

  /**
   * Function for inserting a new request record into MongoDB's timeseries `usage` collection
   *
   * @param projectId {string}
   *   The Project Id that you wish to increment.
   * @param type {string}
   *   The type of request metric you wish to increment (one of 'emails', 'submissionRequests', 'pdfDownloads', 'formRequests')
   */
  _insertRequestDocument(projectId, type) {
    projectId = ensureValueIsString(projectId);
    const document = {
      metadata: {
        project: projectId
      },
      timestamp: moment.utc().toDate(),
      type
    };

    this._db.collection('usage').insertOne(document);
  }

  /**
   * Hook the response and record the event in the UsageCache, after the response is sent.
   *
   * @param req
   * @param res
   * @param next
   */
  hook(req, res) {
    onFinished(res, (err) => {
      if (err) {
        debug(err);
        return;
      }

      if (!req.projectId) {
        return;
      }

      const projectId = req.projectId;
      const path = url.parse(req.url).pathname;
      const type = determineRequestUsageType(path);
      const requestMethod = req.method;

      // Don't count OPTIONS requests as they are just a preliminary request.
      if (requestMethod === 'OPTIONS' || !type) {
        return;
      }

      this._insertRequestDocument(projectId, type);
    });
  }

  /**
   * Get the usage metrics for a given project.
   *
   * @param project {string}
   *   The Project Id to search for.
   *
   */
  async getUsageMetrics(projectId) {
    projectId = ensureValueIsString(projectId);
    if (this._cache.has(projectId)) {
      return this._cache.get(projectId);
    }
    const queryStart = moment.utc().startOf('month').toDate();
    const queryEnd = moment.utc().endOf('month').toDate();

    const usageMetrics = await this._aggregateFromDbAndSetCache(projectId, queryStart, queryEnd);
    return usageMetrics;
  }
}

module.exports = UsageTracking;
