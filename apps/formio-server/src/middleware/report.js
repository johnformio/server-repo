'use strict';

/**
 * This file serves as an aggregation mechanism for projects.
 */
var express = require('express');
var router = express.Router();
var JSONStream = require('JSONStream');
var through = require('through');
var traverse = require('traverse');
var formioUtils = require('formiojs/utils');
var paginate = require('node-paginate-anything');
var _ = require('lodash');
var debug = {
  report: require('debug')('formio:middleware:report'),
  error: require('debug')('formio:error')
};

module.exports = function(formio) {
  var report = function(req, res, next, filter) {
    // A user is always required for this operation.
    if (!req.user || !req.user.roles || !req.user.roles.length) {
      debug.report('Unauthorized');
      return res.status(401).send('Unauthorized');
    }

    if (!req.body) {
      debug.report('No pipeline');
      return res.status(400).send('Must include an aggregation pipeline');
    }

    // Make sure the filter is an array.
    if (!filter || !filter.length) {
      filter = [];
    }
    debug.report('filter', filter);

    // Convert ObjectIds to actual object ids.
    traverse(filter).forEach(function(node) {
      if (typeof node !== 'string') {
        return;
      }

      if (node.match(/^ObjectId\(['|"](.{24})['|"]\)$/)) {
        var result = node.match(/^ObjectId\(['|"](.{24})['|"]\)$/m);
        this.update(formio.util.idToBson(result[1]));
      }
      if (node.match(/^Date\(['|"]?(.[^']+)['|"]?\)$/)) {
        var result = node.match(/^Date\(['|"]?(.[^']+)['|"]?\)$/m);
        // If a non digit exists, use the input as a string.
        let test = result[1].match(/[^\d]/g);
        if (test && test[1]) {
          return this.update(new Date(result[1].toString()));
        }

        try {
          result[1] = parseInt(result[1]);
          return this.update(new Date(result[1]));
        }
        catch (e) {
          debug.error(e);
          return;
        }
      }
    });

    var query = {};
    var stages = [];
    var limitStage = null;
    var skipStage = null;
    var filterStages = function() {
      // Ensure there are no disallowed stages in the aggregation.
      // We may want to include additional stages but better to start with less.
      var allowedStages = ['$match', '$limit', '$sort', '$skip', '$group', '$unwind'];
      /* eslint-disable */
      for (var i in filter) {
        var stage = filter[i];
        var includeStage = false;
        for (var key in stage) {
          // Only allow boolean values for $project
          if (key === '$project') {
            for (var param in stage[key]) {
              if (['number', 'boolean'].indexOf((typeof stage[key][param])) === -1) {
                return true;
              }
            }
            includeStage = true;
          }
          else if (key === '$match') {
            _.merge(query, stage[key]);
          }
          else if (key === '$limit') {
            limitStage = stage;
          }
          else if (key === '$skip') {
            skipStage = stage;
          }
          // Make sure that this is an allowed stage.
          else if (allowedStages.indexOf(key) === -1) {
            return true;
          }
          else {
            includeStage = true;
          }
        }
        if (includeStage) {
          stages.push(filter[i]);
        }
      }
      /* eslint-enable */
      return false;
    };

    if (filterStages()) {
      return res.status(400).send('Disallowed stage used in aggregation.');
    }

    // Get the user roles.
    var userRoles = _.map(req.user.roles, formio.util.idToBson);

    // Find all forms that this user has "read_all" access to or owns and only give them
    // aggregate access to those forms.
    formio.resources.form.model.find({
      '$and': [
        {project: formio.util.idToBson(req.projectId)},
        {'$or': [
          {access: {
            '$elemMatch': {
              type: 'read_all',
              roles: {
                '$in': userRoles
              }
            }
          }},
          {owner: formio.util.idToBson(req.user._id)}
        ]}
      ]
    }).exec(function(err, result) {
      if (err) {
        return next(err);
      }

      var formIds = [];
      var forms = {};

      // Add all these forms to a forms array.
      _.each(result, function(form) {
        formIds.push(form._id);
        forms[form._id.toString()] = form;
      });

      // Make sure to not include deleted submissions.
      if (!req.query.deleted) {
        query.deleted = {$eq: null};
      }

      // Start with the query, then add the remaining stages.
      stages = [{'$match': {form: {'$in': formIds}}}].concat([{'$match': query}]).concat(stages);

      // Add the skip stage first if applicable.
      if (skipStage) {
        stages = stages.concat([skipStage]);
      }

      // Next add the limit stage if applicable.
      if (limitStage) {
        stages = stages.concat([limitStage]);
      }

      // Start out the filter to only include those forms.
      debug.report('final pipeline', stages);

      res.setHeader('Content-Type', 'application/json');

      // Method to perform the aggregation.
      var performAggregation = function() {
        formio.resources.submission.model.aggregate(stages)
        .cursor()
        .exec()
        .stream()
        .pipe(through(function(doc) {
          if (doc && doc.form) {
            var formId = doc.form.toString();
            if (forms.hasOwnProperty(formId)) {
              _.each(formioUtils.flattenComponents(forms[doc.form.toString()].components), function(component) {
                if (component.protected && doc.data && doc.data.hasOwnProperty(component.key)) {
                  delete doc.data[component.key];
                }
              });
            }
          }
          this.queue(doc);
        }))
        .pipe(JSONStream.stringify())
        .pipe(res);
      };

      // If a limit is provided, then we need to include some pagination stuff.
      if (!limitStage) {
        return performAggregation();
      }

      // Determine the count query by limiting based on the formIds.
      var countQuery = _.cloneDeep(query);

      // Add the filtered formIds to the query.
      if (
        query.hasOwnProperty('form') &&
        query.form.hasOwnProperty('$in') &&
        (query.form['$in'].length > 0)
      ) {
        countQuery.form['$in'] = formIds.concat(query.form['$in']);
      }
      else if (query.form) {
        formIds.push(query.form);
        countQuery.form = {'$in': formIds};
      }
      else {
        countQuery.form = {'$in': formIds};
      }

      // Find the total count based on the query.
      formio.resources.submission.model.find(countQuery)
      .count(function(err, count) {
        if (err) {
          debug.error(err);
          return next(err);
        }

        var skip = skipStage ? skipStage['$skip'] : 0;
        var limit = limitStage['$limit'];
        if (!req.headers.range) {
          req.headers['range-unit'] = 'items';
          req.headers.range = skip + '-' + (skip + (limit - 1));
        }

        // Get the page range.
        var pageRange = paginate(req, res, count, limit) || {
          limit: limit,
          skip: skip
        };

        // Alter the skip and limit stages.
        if (skipStage) {
          skipStage['$skip'] = pageRange.skip;
        }
        limitStage['$limit'] = pageRange.limit;

        // Perform the aggregation command.
        performAggregation();
      });
    });
  };

  // Use post to crete aggregation criteria.
  router.post('/', function(req, res, next) {
    debug.report('POST', req.body);
    report(req, res, next, req.body);
  });

  // Allow them to provide the query via headers on a GET request.
  router.get('/', function(req, res, next) {
    var pipeline = [];
    if (req.headers.hasOwnProperty('x-query')) {
      debug.report('GET', req.headers['x-query']);
      try {
        pipeline = JSON.parse(req.headers['x-query']);
      }
      catch (err) {
        debug.error(err);
        return res.status(400).send('Invalid query');
      }
    }

    // create the report.
    report(req, res, next, pipeline);
  });

  return router;
};
