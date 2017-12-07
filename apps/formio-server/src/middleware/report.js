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

module.exports = function(formioServer) {
  var formio = formioServer.formio;

  var report = function(req, res, next, filter) {
    formio.cache.loadPrimaryProject(req, function(err, project) {
      if (err) {
        debug.report(err);
        return res.status(400).send('Could not load the project.');
      }

      debug.report('Plan: ' + project.plan);
      if (['trial', 'team', 'commercial'].indexOf(project.plan) === -1) {
        return res.status(402).send('The report framework requires a Team Pro or Enterprise plan.');
      }

      // Do not perform for Azure Cosmos DB since it does not support aggregation framework.
      if (formio.config.mongo.indexOf('documents.azure.com') !== -1) {
        return res.status(400).send('MongoDB Aggregation is not supported in Azure Cosmos DB');
      }

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
          let result = node.match(/^ObjectId\(['|"](.{24})['|"]\)$/m);
          this.update(formio.util.idToBson(result[1]));
        }
        if (node.match(/^Date\(['|"]?(.[^']+)['|"]?\)$/)) {
          let result = node.match(/^Date\(['|"]?(.[^']+)['|"]?\)$/m);
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

      var readAllForms = [];
      var readOwnForms = [];
      var forms = {};

      // Get all forms in a project.
      formio.resources.form.model.find({
        project: formio.util.idToBson(req.projectId),
        deleted:  {'$eq': null}
      }).exec(function(err, result) {
        if (err) {
          return next(err);
        }

        // Find all forms that this user has "read_all" or "read_own" access
        _.each(result, function(form) {
          const access = form.submissionAccess.toObject();

          // If admin, add to read_all forms.
          if (req.isAdmin) {
            readAllForms.push(form._id);
            forms[form._id.toString()] = form;
          }
          else {
            access.map(item => {
              const roles = item.roles.map(role => role.toString());
              // If has a role with read_all.
              if (item.type === 'read_all' && req.user.roles.some(role => roles.includes(role))) {
                readAllForms.push(form._id);
                forms[form._id.toString()] = form;
              }
              // If has a role with read_own.
              else if (item.type === 'read_own' && req.user.roles.some(role => roles.includes(role))) {
                readOwnForms.push(form._id);
                forms[form._id.toString()] = form;
              }
            });
          }
        });

        // Make sure to not include deleted submissions.
        if (!req.query.deleted) {
          query.deleted = {$eq: null};
        }

        // Start with the query, then add the remaining stages.
        stages = [
          {
            '$match': {'$or': [
                {
                  form: {
                    '$in': readAllForms
                  }
                },
                {
                  form: {
                    '$in': readOwnForms
                  },
                  owner: formio.util.idToBson(req.user._id)
                }
              ]}
          }
        ].concat([{'$match': query}]).concat(stages);

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

        // Replace the limit with a count to get the total items.
        var countStages = stages.filter(stage => !stage.hasOwnProperty('$limit') && !stage.hasOwnProperty('$skip'));

        countStages.push({$count: 'total'});

        // Find the total count based on the query.
        formio.resources.submission.model.aggregate(countStages, function(err, result) {
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
          var total = result.length ? result[0].total : 0;
          var pageRange = paginate(req, res, total, limit) || {
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
