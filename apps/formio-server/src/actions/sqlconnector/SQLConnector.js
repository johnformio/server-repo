'use strict';

const _ = require('lodash');
const async = require('async');
const debug = require('debug')('formio:action:sqlconnector');
const Q = require('q');
const request = require('request');

module.exports = function(router) {
  const Action = router.formio.Action;
  const formio = router.formio;

  /**
   * Add an externalId to the local resource with the remote id.
   *
   * @param {string} localId
   *   The BSON id for the local resource.
   * @param {string} remoteId
   *   The external resource id.
   */
  const addExternalId = function(localId, remoteId) {
    const _find = {_id: localId};
    const _update = {
      $push: {
        externalIds: {
          type: 'sqlconnector',
          id: remoteId
        }
      }
    };

    return Q.ninvoke(formio.resources.submission.model, 'update', _find, _update);
  };

  /**
   * Get the externalId for the current submission.
   *
   * @param {object} res
   *   The express response object.
   *
   * @returns {string|undefined}
   *   The external id for the sqlconnector in the submission if defined.
   */
  const getSubmissionId = function(req, res) {
    let external;

    // If an item was included in the response
    if (_.has(res, 'resource.item') && req.method !== 'DELETE') {
      external = _.find(_.get(res, 'resource.item.externalIds'), function(item) {
        return item.type === 'sqlconnector';
      });
    }
    else if (req.method === 'DELETE') {
      const deleted = _.get(req, `formioCache.submissions.${_.get(req, 'subId')}`);
      if (!deleted) {
        return undefined;
      }
      external = _.find(_.get(deleted, 'externalIds'), function(item) {
        return item.type === 'sqlconnector';
      });
    }

    const id = external
      ? _.get(external, 'id')
      : undefined;

    return id;
  };

  /**
   * SQLConnector class.
   *   This class is used to integrate into external SQL Databases.
   */
  class SQLConnector extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

    static info(req, res, next) {
      next(null, {
        name: 'sqlconnector',
        title: 'SQL Connector (Premium)',
        premium: true,
        description: 'Allows you to execute a remote SQL Query via Resquel.',
        priority: 0,
        defaults: {
          handler: ['after'],
          method: ['create', 'update', 'delete']
        }
      });
    }

    static settingsForm(req, res, next) {
      formio.hook.settings(req, function(err, settings) {
        if (err) {
          debug(err);
          return next(null, {});
        }

        settings = settings || {};
        if (!settings.sqlconnector) {
          return res.status(400).send('No project settings were found for the SQL Connector.');
        }

        const missingSetting = _.find(['host', 'type'], function(prop) {
          return !settings.sqlconnector[prop];
        });
        if (missingSetting) {
          return res.status(400).send('The SQL Connector is missing required settings.');
        }

        const form = [];
        async.waterfall([
          function addBlockCheckbox(cb) {
            form.push({
              conditional: {
                eq: '',
                when: null,
                show: ''
              },
              type: 'checkbox',
              validate: {
                required: false
              },
              persistent: true,
              protected: false,
              defaultValue: false,
              key: 'block',
              label: 'Block request for SQL Connector feedback',
              hideLabel: true,
              tableView: true,
              inputType: 'checkbox',
              input: true
            });
            return cb();
          },
          function addTableName(cb) {
            form.push({
              label: 'Table Name',
              key: 'table',
              inputType: 'text',
              defaultValue: '',
              input: true,
              placeholder: 'Which table is this in?',
              prefix: '',
              suffix: '',
              type: 'textfield',
              multiple: false,
              validate: {
                required: true
              }
            });
            return cb();
          },
          function addTablePrimaryKey(cb) {
            form.push({
              label: 'Primary Key',
              key: 'primary',
              inputType: 'text',
              defaultValue: 'id',
              input: true,
              placeholder: 'What is the primary key for this table? (Must be self incrementing/updating)',
              prefix: '',
              suffix: '',
              type: 'textfield',
              multiple: false,
              validate: {
                required: true
              }
            });
            return cb();
          },
          function getFormComponents(cb) {
            try {
              // Load the current form, to get all the components.
              formio.cache.loadCurrentForm(req, function(err, form) {
                if (err) {
                  return cb(err);
                }

                // Filter non-input components.
                const components = [];
                formio.util.eachComponent(form.components, function(component) {
                  if (
                    !formio.util.isLayoutComponent(component) &&
                    component.input === true &&
                    component.type !== 'button' &&
                    component.type !== 'email'
                  ) {
                    components.push(component);
                  }
                });

                return cb(null, components);
              });
            }
            catch (e) {
              return cb('Could not load the settings form.');
            }
          },
          function addMappingDatagrid(components, cb) {
            form.push({
              conditional: {
                eq: '',
                when: null,
                show: ''
              },
              tags: [],
              type: 'datagrid',
              persistent: true,
              protected: false,
              key: 'fields',
              label: 'Fields',
              tableView: true,
              components: [{
                lockKey: true,
                tags: [],
                hideLabel: true,
                type: 'textfield',
                conditional: {
                  eq: '',
                  when: null,
                  show: ''
                },
                validate: {
                  customPrivate: false,
                  custom: '',
                  pattern: '',
                  maxLength: '',
                  minLength: '',
                  required: false
                },
                persistent: true,
                unique: false,
                protected: false,
                defaultValue: '',
                multiple: false,
                suffix: '',
                prefix: '',
                placeholder: '',
                key: 'column',
                label: 'Column Name',
                inputMask: '',
                inputType: 'text',
                tableView: true,
                input: true
              }, {
                conditional: {
                  eq: '',
                  when: null,
                  show: ''
                },
                tags: [],
                hideLabel: true,
                type: 'select',
                validate: {
                  required: false
                },
                persistent: true,
                unique: false,
                protected: false,
                multiple: false,
                template: '<span>{{ item.label }}</span>',
                authenticate: false,
                filter: '',
                refreshOn: '',
                defaultValue: '',
                valueProperty: '',
                dataSrc: 'json',
                data: {
                  json: JSON.stringify(components || [])
                },
                placeholder: '',
                key: 'field',
                label: 'Field',
                tableView: true,
                input: true
              }],
              tree: true,
              input: true
            });
            return cb();
          }
        ], function(err) {
          if (err) {
            return next(err);
          }

          return next(null, form);
        });
      });
    }

    /**
     * Trigger the Resquel request.
     *
     * @param handler
     * @param method
     * @param req
     *   The Express request object.
     * @param res
     *   The Express response object.
     * @param next
     *   The callback function to execute upon completion.
     */
    resolve(handler, method, req, res, next) { // eslint-disable-line max-statements
      const settings = this.settings;

      // Only block on the external request, if configured
      if (!_.has(settings, 'block') || settings.block === false) {
        next(); // eslint-disable-line callback-return
      }

      const handleErrors = function(err) {
        debug(err);
        try {
          return Q()
          .then(function() {
            // If this is not a creation, skip clean up of the failed item.
            if (method !== 'post') {
              return;
            }

            const localId = _.get(res, 'resource.item._id');
            if (!localId) {
              return;
            }

            const _find = {_id: localId};
            const _update = {
              $set: {
                deleted: Date.now()
              }
            };
            return Q.ninvoke(formio.resources.submission.model, 'update', _find, _update);
          })
          .then(function() {
            // If blocking is on, return the error.
            if (_.has(settings, 'block') && settings.block === true) {
              return next(err.message || err);
            }
            return;
          })
          .catch(function(err) {
            debug(err);
          });
        }
        catch (e) {
          debug(e);
        }
      };

      try {
        method = req.method.toString().toLowerCase();
        const options = {
          method: method
        };

        const primary = this.settings.primary;
        let project = formio.cache.currentProject(req);
        if (project === null || project === undefined) {
          return handleErrors('No project found.');
        }
        else {
          try {
            project = project.toObject();
          }
          catch (e) {
            // Project is already a plain object.
          }
        }

        // Add basic auth if available.
        if (_.has(project, 'settings.sqlconnector.user')) {
          _.set(options, 'auth.user', _.get(project, 'settings.sqlconnector.user'));
        }
        if (_.has(project, 'settings.sqlconnector.password')) {
          _.set(options, 'auth.password', _.get(project, 'settings.sqlconnector.password'));
        }

        // Build the base url.
        options.url = `${_.get(project, 'settings.sqlconnector.host')}/${this.settings.table}`;

        // If this was not a post request, determine which existing resource we are modifying.
        if (method !== 'post') {
          const externalId = getSubmissionId(req, res);
          if (externalId !== undefined) {
            options.url += `/${externalId}`;
          }
        }

        // If this is a create/update, determine what to send in the request body.
        if (['post', 'put'].indexOf(method) !== -1) {
          options.json = true;
          const item = _.has(res, 'resource.item')
            ? (_.get(res, 'resource.item')).toObject()
            : _.get(req, 'body');

          // Remove protected fields from the external request.
          formio.util.removeProtectedFields(req.currentForm, method, item);
          options.body = item;
        }

        options.timeout = 10000;
        process.nextTick(function() {
          request(options, function(err, response, body) {
            if (err) {
              return handleErrors(err);
            }

            // If this is not a new resource, skip link phase for new resources.
            if (method !== 'post') {
              // if the request was blocking, return here.
              if (_.has(settings, 'block') && settings.block === true) {
                return next();
              }
              return;
            }

            // Attempt to modify linked resources.
            return Q()
              .then(function() {
                if (!response) {
                  throw new Error('Invalid response.');
                }

                if (!(/^2\d\d$/i.test(response.statusCode))) {
                  throw new Error((response.body || '').toString().replace(/<br>/, ''));
                }

                const results = _.get(response, 'body.rows');
                if (!(results instanceof Array)) {
                  // No clue what to do here.
                  throw new Error(
                    `Expected array of results, got ${typeof results}(${JSON.stringify(results)})`
                  );
                }
                if (results.length === 1) {
                  return results[0];
                }

                throw new Error(`More than one result: ${results.length}`);
              })
              .then(function(remoteItem) {
                // Get the localId
                const localId = _.get(res, 'resource.item._id');
                if (!localId) {
                  throw new Error(`Unknown local item id: ${localId}`);
                }
                // Get the remoteId
                const remoteId = _.get(remoteItem, primary);
                if (!remoteId && remoteId !== 0) {
                  throw new Error(`Unknown remote item id (${remoteId}) for primary key.`);
                }

                if (method === 'post') {
                  return addExternalId(localId, remoteId);
                }
              })
              .then(function() {
                // if the request was blocking, return here.
                if (_.has(settings, 'block') && settings.block === true) {
                  return next();
                }
              })
              .catch(function(err) {
                // If blocking is on, return the error.
                return handleErrors(err);
              });
          });
        });
      }
      catch (err) {
        return handleErrors(err);
      }
    }
  }

  // Return the SQLConnector.
  return SQLConnector;
};
