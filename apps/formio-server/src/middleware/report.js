'use strict';

/**
 * This file serves as an aggregation mechanism for projects.
 */
const express = require('express');
const router = express.Router();
const JSONStream = require('JSONStream');
const through = require('through');
const traverse = require('traverse');
const paginate = require('node-paginate-anything');
const _ = require('lodash');
const util = require('../util/util');
const debug = {
  report: require('debug')('formio:middleware:report'),
  error: require('debug')('formio:error')
};

module.exports = function(formioServer) {
  const formio = formioServer.formio;

  const report = function(req, res, next, filter) {
    formio.cache.loadPrimaryProject(req, function(err, project) {
      if (err) {
        debug.report(err);
        return res.status(400).send('Could not load the project.');
      }

      debug.report(`Plan: ${project.plan}`);
      if (!['trial', 'team', 'commercial'].includes(project.plan)) {
        return res.status(402).send('The report framework requires a Team Pro or Enterprise plan.');
      }

      // A user is always required for this operation.
      if (!req.isAdmin && (!req.user || !req.user.roles || !req.user.roles.length)) {
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

        if (
          this.key.match(/(^|\.)(_id|form|owner)$/) ||
          (
            (this.parent && (this.parent.key === '$in')) &&
            (this.parent.parent && this.parent.parent.key.match(/(^|\.)(_id|form|owner)$/))
          )
        ) {
          if (node.match(/^(.{24})$/)) {
            const result = node.match(/^(.{24})$/);
            this.update(formio.util.idToBson(result[1]));
          }
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
      const userRoles = [];
      if (!req.isAdmin && req.user && req.user._id) {
        userRoles.push(formio.util.idToBson(req.user._id));
        if (req.user.roles && req.user.roles.length) {
          req.user.roles.forEach((role) => userRoles.push(formio.util.idToBson(role)));
        }
      }

      let stages = [];
      let preStage = [];
      const accessCheckQuerySettings = {};
      let limitStage = null;
      let skipStage = null;
      const filterStages = function() {
        // Ensure there are no disallowed stages in the aggregation.
        // We may want to include additional stages but better to start with less.
        const allowedStages = ['$match', '$limit', '$sort', '$skip', '$group', '$unwind', '$lookup', '$project', '$set', '$addFields'];
        /* eslint-disable */
        for (let i in filter) {
          let stage = filter[i];
          let includeStage = false;
          for (let key in stage) {
            // Only allow boolean values for $project
            if (key === '$limit') {
              limitStage = stage;
            }
            else if (key === '$skip') {
              skipStage = stage;
            }
            // Make sure that this is an allowed stage.
            else if (!allowedStages.includes(key)) {
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

      let modelReady;
      const protectedFields = {};

      // Ensure the project is always set to the project in context.
      query.project = accessCheckQuerySettings.project = formio.util.idToBson(req.projectId);

      const getForms = function(formsNext) {
        // Make sure to not include deleted submissions.
        if (!req.query.deleted) {
          query.deleted = {$eq: null};
          accessCheckQuerySettings.excludeDeleted = true;
        }

        if (req.isAdmin && !query.form) {
          // Speed up the report api by skipping the forms.
          modelReady = Promise.resolve(formio.resources.submission.model);
          preStage = [{'$match': query}];
          return formsNext();
        }

        const forms = [];
        const readAllForms = [];
        const readOwnForms = [];
        const formQuery = {
          project: formio.util.idToBson(req.projectId),
          deleted:  {'$eq': null}
        };

        // If they are already filtering on the form, then include that in the form query.
        if (query.form) {
          formQuery._id = query.form;
        }

        // Get all forms in a project.
        formio.resources.form.model.find(formQuery).exec(function(err, result) {
          if (err) {
            return formsNext(err);
          }

          // Find all forms that this user has "read_all" or "read_own" access
          _.each(result, function(form) {
            const access = form.submissionAccess.toObject();
            if (req.isAdmin || (_.includes(_.keys(req.user.access), req.currentProject.name) && req.userProject.name === 'formio')) {
              readAllForms.push(form._id);
            }
            else {
              _.map(access, (item) => {
                const roles = _.map(item.roles, (role) => role.toString());
                if (item.type === 'read_all' && req.user.roles.some((role) => roles.includes(role))) {
                  readAllForms.push(form._id);
                }
                else if (item.type === 'read_own' && req.user.roles.some((role) => roles.includes(role))) {
                  readOwnForms.push(form._id);
                }
              });
            }

            forms.push(form._id);
            protectedFields[form._id.toString()] = [];
            formio.util.FormioUtils.eachComponent(form.components, (component, path) => {
              if (component.protected) {
                protectedFields[form._id.toString()].push(path);
              }
            });
          });

          modelReady = new Promise((resolve, reject) => {
            util.getSubmissionModel(formio, req, result[0], true, (err, collectionModel) => {
              if (collectionModel) {
                resolve(collectionModel);
              }
              else {
                resolve(formio.resources.submission.model);
              }
            });
          });

          // If they do not provide a form limit, it should at least be the forms.
          if (!query.form) {
            query.form = {$in: forms};
            accessCheckQuerySettings.forms = forms;
          }

          preStage = [{'$match': query}];
          if (!req.isAdmin) {
            accessCheckQuerySettings.userRoles = userRoles;
            accessCheckQuerySettings.readAllForms = readAllForms;
            accessCheckQuerySettings.readOwnForms = readOwnForms;
            const owner = accessCheckQuerySettings.owner = formio.util.idToBson(req.user._id);

            preStage = preStage.concat([
              {
                '$addFields': {
                  'hasAccess': {
                    $gt: [{
                      $size: {
                        $setIntersection: [
                          userRoles,
                          {
                            $reduce: {
                              input: '$access',
                              initialValue: [],
                              in: {$concatArrays: ["$$value", "$$this.resources"]}
                            }
                          }
                        ]
                      }
                    }, 0]
                  }
                }
              },
              {
                '$match': {
                  '$or': [
                    {
                      form: {
                        '$in': readAllForms
                      }
                    },
                    {
                      form: {
                        '$in': readOwnForms
                      },
                      owner
                    },
                    {
                      hasAccess: true
                    }
                  ]
                }
              }
            ]);
          }

          formsNext();
        });
      };

      // required for DBs that do not support multiple join conditions and uncorrelated subquery for lookup operator (e.g. DocumentDB)
      const getLookupPostStage = function(lookupResultingField) {
        const {
          project,
          excludeDeleted,
          forms,
          userRoles,
          readAllForms,
          readOwnForms,
          owner,
        } = accessCheckQuerySettings;
        const filterConditions = [];

        if (project) {
          filterConditions.push({
            $eq: ['$$item.project', project],
          });
        }

        if (excludeDeleted) {
          filterConditions.push({
            $eq: ['$$item.deleted', null],
          });
        }

        if (forms) {
          filterConditions.push({
            $in: ['$$item.form', forms],
          });
        }

        if (userRoles) {
          filterConditions.push({
            $or: [
              {
                $in: ['$$item.form', readAllForms || []],
              },
              {
                $and: [
                  {
                    $in: ['$$item.form', readOwnForms || []],
                  },
                  {
                    $eq: ['$$item.owner', owner],
                  },
                ],
              },
              {
                $gt: [
                  {
                    $size: {
                      $setIntersection: [
                        userRoles,
                        {
                          $reduce: {
                            input: '$$item.access',
                            initialValue: [],
                            in: {
                              $concatArrays: ['$$value', '$$this.resources'],
                            },
                          },
                        },
                      ],
                    },
                  },
                  0,
                ],
              },
            ],
          });
        }

        return {
          $addFields: {
            [`${lookupResultingField}`]: {
              $filter: {
                input: `$${lookupResultingField}`,
                as: 'item',
                cond: {
                  $and: filterConditions,
                },
              },
            },
          },
        };
      };

      // Get all forms in a project.
      getForms(function(err) {
        if (err) {
          return next(err);
        }
        // check if poststage (instead of prestages) with access check are required as lookup with pipeline is not supported by DocumentDB.
        const requireLookupPostStage = _.some(stages, stage => stage.$lookup && !stage.$lookup.pipeline)
          && !_.some(stages, stage => stage.$lookup && _.isArray(stage.$lookup.pipeline));

        const initialStages = stages;
        stages = [];

        // Add prestages/poststage for lookup
        _.each(initialStages, stage => {
          const lookupSettings = stage.$lookup;

          if (lookupSettings && _.isPlainObject(lookupSettings) ) {
            if (!requireLookupPostStage) {
              lookupSettings.pipeline = _.isArray(lookupSettings.pipeline)
                ? preStage.concat(lookupSettings.pipeline)
                : preStage;

              stages.push(stage);
            }
            else {
              stages.push(stage);
              stages.push(getLookupPostStage(lookupSettings.as));
            }
          }
          else {
            stages.push(stage);
          }
        });

        // Add the prestages to the beginning of the stages.
        stages = preStage.concat(stages);
        res.setHeader('Content-Type', 'application/json');

        // Find the total count based on the query.
        modelReady.then((model) =>
          model.aggregate(stages.concat([{$count: 'total'}])).exec(function(err, result) {
            if (err) {
              debug.error(err);
              return next(err);
            }

            const skip = skipStage ? skipStage['$skip'] : 0;
            const limit = limitStage ? limitStage['$limit'] : 100;
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
            limitStage = {'$limit': pageRange.limit};

            // Perform the aggregation command.
            if (skipStage) {
              stages.push(skipStage);
            }

            // Next add the limit.
            stages.push({'$limit': pageRange.limit});

            // Perform the aggregation.
            debug.report('final pipeline', stages);
            model.aggregate(stages)
              .cursor()
              .pipe(through(function(doc) {
                if (doc && doc.form && doc.data) {
                  const formId = doc.form.toString();
                  if (protectedFields.hasOwnProperty(formId)) {
                    _.each(protectedFields[formId], (path) => _.set(doc.data, path, '--- PROTECTED ---'));
                  }
                }
                this.queue(doc);
              }))
              .pipe(JSONStream.stringify())
              .pipe(res);
          })
        ).catch((err) => res.status(400).send(err.message));
      });
    });
  };

  // Use post to crete aggregation criteria.
  router.post('/', function(req, res, next) {
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
