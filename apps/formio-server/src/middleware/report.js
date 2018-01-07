'use strict';

/**
 * This file serves as an aggregation mechanism for projects.
 */
const express = require('express');
const router = express.Router();
const JSONStream = require('JSONStream');
const through = require('through');
const traverse = require('traverse');
const formioUtils = require('formiojs/utils');
const paginate = require('node-paginate-anything');
const _ = require('lodash');
const debug = {
  report: require('debug')('formio:middleware:report'),
  error: require('debug')('formio:error')
};

module.exports = function(formioServer) {
  const formio = formioServer.formio;

  /* eslint-disable max-statements */
  const report = function(req, res, next, filter) {
    formio.cache.loadPrimaryProject(req, function(err, project) {
      if (err) {
        debug.report(err);
        return res.status(400).send('Could not load the project.');
      }

      debug.report(`Plan: ${project.plan}`);
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
          const result = node.match(/^ObjectId\(['|"](.{24})['|"]\)$/m);
          this.update(formio.util.idToBson(result[1]));
        }
        if (node.match(/^Date\(['|"]?(.[^']+)['|"]?\)$/)) {
          const result = node.match(/^Date\(['|"]?(.[^']+)['|"]?\)$/m);
          // If a non digit exists, use the input as a string.
          const test = result[1].match(/[^\d]/g);
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

      const query = {};
      let stages = [];
      let limitStage = null;
      let skipStage = null;
      const filterStages = function() {
        // Ensure there are no disallowed stages in the aggregation.
        // We may want to include additional stages but better to start with less.
        const allowedStages = ['$match', '$limit', '$sort', '$skip', '$group', '$unwind'];
        /* eslint-disable */
        for (let i in filter) {
          let stage = filter[i];
          let includeStage = false;
          for (let key in stage) {
            // Only allow boolean values for $project
            if (key === '$project') {
              for (let param in stage[key]) {
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

      const userRoles = _.filter(_.concat(
        _.map(req.user.roles, (role) => {
          return role ? formio.util.idToBson(role) : '';
        }),
        _.map(req.user.roles, (role) => {
          return role ? role.toString() : '';
        })
      ));

      const forms = [];
      const protectedFields = {};
      const formQuery = {
        project: formio.util.idToBson(req.projectId),
        deleted:  {'$eq': null}
      };

      // If they are already filtering on the form, then include that in the form query.
      if (query.form) {
        formQuery.form = query.form;
      }

      // Get all forms in a project.
      formio.resources.form.model.find(formQuery).exec(function(err, result) {
        if (err) {
          return next(err);
        }

        // Find all forms that this user has "read_all" or "read_own" access
        _.each(result, function(form) {
          forms.push(form._id);
          protectedFields[form._id.toString()] = [];
          formioUtils.eachComponent(form.components, (component, path) => {
            if (component.protected) {
              protectedFields[form._id.toString()].push(path);
            }
          });
        });

        // Make sure to not include deleted submissions.
        if (!req.query.deleted) {
          query.deleted = {$eq: null};
        }

        // If they do not provide a form limit, it should at least be the forms.
        if (!query.form) {
          query.form = {$in: forms};
        }

        // A query to determine if the users roles are within the forms submission access.
        const userAccessQuery = function(type) {
          return {
            $gt: [
              {
                $size: {
                  $setIntersection: [
                    {
                      $reduce: {
                        input: '$formObj.submissionAccess',
                        initialValue: [],
                        in: {
                          $setUnion: [
                            '$$value',
                            {
                              $cond: {
                                if: {
                                  $eq: ["$$this.type", type]
                                },
                                then: '$$this.roles',
                                else: []
                              }
                            }
                          ]
                        }
                      }
                    },
                    userRoles
                  ]
                }
              }, 0
            ]
          };
        };

        let preStages = [
          // Perform the query.
          {'$match': query},

          // Load in the form object into the submission.
          {
            '$lookup': {
              from: 'forms',
              localField: 'form',
              foreignField: '_id',
              as: 'formObj'
            }
          },
          {'$unwind': '$formObj'}
        ];

        // If they are not an admin, then add the access checks.
        if (!req.isAdmin) {
          preStages = preStages.concat([
            {
              '$addFields': {
                'hasAccess': {
                  $or: [
                    // User roles are within any read_all roles.
                    userAccessQuery('read_all'),
                    {
                      $and: [
                        // User roles are within read_own roles
                        userAccessQuery('read_own'),

                        // AND the owner of the submission is the current user.
                        {$in: ['$owner', [req.user._id.toString(), req.user._id]]}
                      ]}
                  ]
                }
              }
            },

            // Ensure that this user has access to this submission.
            {
              '$match': {
                'hasAccess': true
              }
            }
          ]);
        }

        preStages = preStages.concat([
          // Load the project for this form.
          {
            '$lookup': {
              from: 'projects',
              localField: 'formObj.project',
              foreignField: '_id',
              as: 'project'
            }
          },
          {'$unwind': '$project'},

          // Ensure that they can only grab submissions from this project.
          {
            '$match': {
              'project._id': formio.util.idToBson(req.projectId)
            }
          },

          // Remove the fields that were used for the query.
          {
            '$project': {
              'formObj': 0,
              'project': 0,
              'hasAccess': 0
            }
          }
        ]);

        // Add the prestages to the beginning of the stages.
        stages = preStages.concat(stages);

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
        const performAggregation = function() {
          formio.resources.submission.model.aggregate(stages)
            .cursor()
            .exec()
            .stream()
            .pipe(through(function(doc) {
              if (doc && doc.form && doc.data) {
                var formId = doc.form.toString();
                if (protectedFields.hasOwnProperty(formId)) {
                  _.each(protectedFields[formId], (path) => _.set(doc.data, path, '--- PROTECTED ---'));
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
        const countStages = stages.filter(stage => !stage.hasOwnProperty('$limit') && !stage.hasOwnProperty('$skip'));

        countStages.push({$count: 'total'});

        // Find the total count based on the query.
        formio.resources.submission.model.aggregate(countStages, function(err, result) {
          if (err) {
            debug.error(err);
            return next(err);
          }

          const skip = skipStage ? skipStage['$skip'] : 0;
          const limit = limitStage['$limit'];
          if (!req.headers.range) {
            req.headers['range-unit'] = 'items';
            req.headers.range = `${skip}-${skip + (limit - 1)}`;
          }

          // Get the page range.
          const total = result.length ? result[0].total : 0;
          const pageRange = paginate(req, res, total, limit) || {
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
  /* eslint-enable max-statements */

  // Use post to crete aggregation criteria.
  router.post('/', function(req, res, next) {
    debug.report('POST', req.body);
    report(req, res, next, req.body);
  });

  // Allow them to provide the query via headers on a GET request.
  router.get('/', function(req, res, next) {
    let pipeline = [];
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
