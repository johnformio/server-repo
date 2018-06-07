'use strict';

const onFinished = require('on-finished');
const url = require('url');
const _ = require('lodash');
const debug = {
  record: require('debug')('formio:analytics:record'),
  hook: require('debug')('formio:analytics:hook'),
  getCalls: require('debug')('formio:analytics:getCalls'),
  getYearlyAnalytics: require('debug')('formio:analytics:getYearlyAnalytics'),
  getMonthlyAnalytics: require('debug')('formio:analytics:getMonthlyAnalytics'),
  getDailyAnalytics: require('debug')('formio:analytics:getDailyAnalytics'),
  getFormioFormByName: require('debug')('formio:analytics:getFormioFormByName')
};

class FormioAnalytics {
  constructor(redis) {
    this.redis = redis;
    this.formio = null;
  }

  /**
   * Hook the response and record the event in redis, after the response is sent.
   *
   * @param req
   * @param res
   * @param next
   */
  hook(req, res, next) {
    // Attach the request start time.
    req._start = (new Date()).getTime();

    /* eslint-disable callback-return */
    next();
    /* eslint-enable callback-return */

    onFinished(res, (err) => {
      if (err) {
        debug.hook(err);
        return;
      }
      if (!req.projectId) {
        return;
      }

      const id = req.projectId;
      const path = url.parse(req.url).pathname;
      const start = req._start;
      this.redis.record(id, path, req.method, start);
    });
  }

  /**
   * Get the number of calls made for the given month and project.
   *
   * @param month {number|string}
   *   The month number to search for (0-11).
   * @param project {string}
   *   The Project Id to search for.
   * @param next {function}
   */
  getCalls(year, month, day, project, next) {
    this.redis.calls(year, month, day, project, next);
  }

  redisGet(key, next) {
    this.redis.get(key, next);
  }

  redisSet(key, value, next) {
    this.redis.set(key, value, next);
  }

  getEmailCountKey(project) {
    const year = (new Date()).getUTCFullYear().toString();
    const month = ((new Date()).getUTCMonth() + 1).toString();
    return `email:${project}:${year}${month}`;
  }

  getEmailCount(project, next) {
    this.redis.get(this.getEmailCountKey(project), (err, count) => {
      if (err) {
        return next(err);
      }

      count = _.isNaN(count) ? 0 : parseInt(count);
      return next(null, count);
    });
  }

  incrementEmailCount(project, limit, next) {
    this.getEmailCount(project, (err, count) => {
      if (err) {
        return next(err);
      }

      if (count > parseInt(limit, 10)) {
        return next('Over email limit');
      }

      count++;
      this.redis.set(this.getEmailCountKey(project), count);
      return next(null, count);
    });
  }

  /**
   * Check if the given value is inclusively between the range of low and high.
   *
   * @param {Number} value
   *   The value to compare.
   * @param {Number} low
   *   The lowest inclusive number for acceptance.
   * @param {Number} high
   *   The highest inclusive number for acceptance.
   *
   * @returns {boolean}
   *   If the given value is in the range of low to high.
   */
  between(value, low, high) {
    if (!value || !low || !high) {
      return false;
    }

    value = parseInt(value);
    low = parseInt(low);
    high = parseInt(high);

    if (value >= low && value <= high) {
      return true;
    }
    else {
      return false;
    }
  }

  /**
   * Get the formio analytics using the given glob and a redis transaction, and dump to json.
   *
   * @param {String} glob
   *   The glob pattern to match.
   * @param {Object} res
   *   The Express response object.
   */
  getFormioAnalytics(project, year, month, day, type, res) {
    this.redis.analytics(project, year, month, day, type, (err, analytics) => {
      if (err) {
        return res.status(500).send(err);
      }

      return res.status(200).json(analytics);
    });
  }

  /**
   * Get the formio form, by name, for consumption elsewhere.
   *
   * @param name
   * @param req
   * @param next
   */
  getFormioFormByName(name, req, next) {
    this.formio.cache.loadProjectByName(req, 'formio', (err, project) => {
      if (err || !project) {
        return next('Could not load Form.io project.');
      }

      try {
        project = project.toObject();
      }
      catch (err) {
        debug.getFormioFormByName(err);
      }

      this.formio.resources.form.model.findOne({project: project._id, name: name}, (err, form) => {
        if (err) {
          return next('Could not load Form.io user resource.');
        }

        try {
          form = form.toObject();
        }
        catch (e) {
          debug.getFormioFormByName(err);
        }

        return next(null, form);
      });
    });
  }

  /**
   * Get the formio projects created using the given query.
   *
   * @param {Object} query
   * @param {Object} res
   */
  getFormioProjectsCreated(query, res) {
    this.formio.resources.project.model.find(query, (err, projects) => {
      if (err) {
        return res.status(500).send(err);
      }

      const final = _(projects)
        .map((project) => {
          return {
            _id: project._id,
            name: project.name,
            title: project.title,
            description: project.description || '',
            created: project.created,
            owner: project.owner,
            deleted: project.deleted || null,
            plan: project.plan
          };
        })
        .value();

      res.status(200).json(final);
    });
  }

  /**
   * Get the formio users created using the given query.
   *
   * @param query
   * @param req
   * @param res
   */
  getFormioUsersCreated(query, req, res) {
    this.getFormioFormByName('user', req, (err, form) => {
      if (err) {
        return res.status(500).send(err);
      }

      // Attach the user form _id.
      query.form = form._id;

      // Get the submissions.
      this.formio.resources.submission.model.find(query, (err, users) => {
        if (err) {
          return res.status(500).send(err);
        }

        const final = _(users)
          .map((user) => {
            return {
              _id: user._id,
              data: {
                email: (user.data && user.data.email) || '',
                name: (user.data && user.data.name) || '',
                fullName: (user.data && user.data.fullName) || ''
              },
              created: user.created,
              deleted: user.deleted || null
            };
          })
          .value();

        res.status(200).json(final);
      });
    });
  }

  /**
   * Get the formio project upgrade history using the given query.
   *
   * @param query
   * @param req
   * @param res
   */
  getProjectUpgrades(query, req, res) {
    this.getFormioFormByName('projectUpgradeHistory', req, (err, form) => {
      if (err) {
        return res.status(500).send(err);
      }

      // Attach the form _id.
      query.form = this.formio.util.idToBson(form._id);

      this.formio.resources.submission.model.find(query, (err, upgrades) => {
        if (err) {
          return res.status(500).send(err);
        }

        const projects = upgrades.map((item) => {
          return this.formio.util.idToBson(item.data.projectId);
        });

        this.formio.resources.project.model.aggregate([
          {$match: {_id: {$in: projects}}},
          {$lookup: {
              from: 'submissions',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner'
            }},
          {$unwind: '$owner'},
          {$project: {
              _id: 1,
              plan: 1,
              deleted: 1,
              created: 1,
              modified: 1,
              name: 1,
              title: 1,
              owner: {
                deleted: 1,
                data: {
                  fullName: 1,
                  name: 1,
                  email: 1
                },
                form: 1,
                modified: 1,
                created: 1,
                _id: 1
              }
            }}
        ]).exec((err, results) => {
          if (err) {
            return res.status(500).send(err);
          }

          const projMap = {};
          results.forEach((p) => {
            projMap[p._id] = p;
          });

          // Update the original upgrade submissions.
          const final = upgrades.map((sub) => {
            sub.data.project = projMap[sub.data.projectId];
            delete sub.data.projectId;
            return sub;
          });

          return res.status(200).json(final);
        });
      });
    });
  }

  /**
   * Get the formio project upgrade history using the given query.
   *
   * @param query
   * @param req
   * @param res
   */
  getProjectsCreated(query, req, res) {
    this.formio.resources.project.model.aggregate([
      {$match: query},
      {$lookup: {
          from: 'submissions',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner'
        }},
      {$unwind: '$owner'},
      {$project: {
          _id: 1,
          plan: 1,
          deleted: 1,
          created: 1,
          modified: 1,
          name: 1,
          title: 1,
          owner: {
            deleted: 1,
            data: {
              fullName: 1,
              name: 1,
              email: 1
            },
            form: 1,
            modified: 1,
            created: 1,
            _id: 1
          }
        }}
    ]).exec((err, results) => {
      if (err) {
        return res.status(500).send(err);
      }

      return res.status(200).json(results);
    });
  }

  routes(formio) {
    this.formio = formio;
    return {
      project: require('./project')(this),
      admin: require('./admin')(this)
    };
  }
}

module.exports = function(redis) {
  return new FormioAnalytics(redis);
};
