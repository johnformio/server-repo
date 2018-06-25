'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:action:sqlconnector');
const request = require('request-promise-native');

module.exports = (router) => {
  const Action = router.formio.Action;
  const formio = router.formio;
  const hook = formio.hook;

  /**
   * Add an externalId to the local resource with the remote id.
   *
   * @param {string} localId
   *   The BSON id for the local resource.
   * @param {string} remoteId
   *   The external resource id.
   */
  function addExternalId(localId, remoteId) {
    const find = {_id: localId};
    const update = {
      $push: {
        externalIds: {
          type: 'sqlconnector',
          id: remoteId,
        },
      },
    };

    return formio.resources.submission.model.update(find, update);
  }

  /**
   * Get the externalId for the current submission.
   *
   * @param {object} res
   *   The express response object.
   *
   * @returns {string|undefined}
   *   The external id for the sqlconnector in the submission if defined.
   */
  function getSubmissionId(req, res) {
    let external;

    // If an item was included in the response
    if (res.resource.item) {
      external = (res.resource.previousItem || res.resource.item)
        .externalIds.find((item) => item.type === 'sqlconnector');
    }

    return external
      ? external.id
      : null;
  }

  /**
   * SQLConnector class.
   *   This class is used to integrate into external SQL Databases.
   */
  class SQLConnector extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'sqlconnector',
        title: 'SQL Connector',
        description: 'Allows you to execute a remote SQL Query via Resquel.',
        priority: 0,
        defaults: {
          handler: ['after'],
          method: ['create', 'update', 'delete']
        }
      }));
    }

    static settingsForm(req, res, next) {
      hook.settings(req, (err, settings) => {
        if (err) {
          debug(err);
          return next(null, {});
        }

        settings = settings || {};
        if (!settings.sqlconnector) {
          return res.status(400).send('No project settings were found for the SQL Connector.');
        }

        const missingSetting = ['host', 'type'].find((prop) => !settings.sqlconnector[prop]);
        if (missingSetting) {
          return res.status(400).send('The SQL Connector is missing required settings.');
        }

        const form = [
          {
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
            tableView: true,
            inputType: 'checkbox',
            input: true
          },
          {
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
          },
          {
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
          }
        ];

        new Promise((resolve, reject) => {
          // Load the current form, to get all the components.
          formio.cache.loadCurrentForm(req, (err, form) => {
            if (err) {
              return reject(err);
            }

            // Filter non-input components.
            const components = [];
            formio.util.eachComponent(form.components, (component) => {
              if (
                !formio.util.isLayoutComponent(component) &&
                component.input === true &&
                component.type !== 'button' &&
                component.type !== 'email'
              ) {
                components.push(component);
              }
            });

            return resolve(components);
          });
        })
          .then((components) => {
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
            return next(null, form);
          })
          .catch(() => next('Could not load the settings form.'));
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
      const settings = this.settings || {};

      // Only block on the external request, if configured
      if (!settings.block || settings.block === false) {
        next(); // eslint-disable-line callback-return
      }

      function handleErrors(err) {
        debug(err);
        try {
          // If this is not a creation, skip clean up of the failed item.
          if (method !== 'post' || !res.resource) {
            if (settings.block === true) {
              return next(err);
            }
            return;
          }

          const localId = res.resource.item._id;
          if (!localId) {
            return;
          }

          const find = {_id: localId};
          const update = {
            $set: {
              deleted: Date.now(),
            },
          };

          return formio.resources.submission.model.update(find, update).exec()
            .then(() => {
              // If blocking is on, return the error.
              if (settings.block === true) {
                return next(err.message || err);
              }
              return;
            })
            .catch(debug);
        }
        catch (e) {
          debug(e);
        }
      }

      try {
        method = req.method.toString().toLowerCase();
        const options = {
          method,
        };

        const primaryKey = this.settings.primary;
        let project = formio.cache.currentProject(req);
        if (_.isNil(project)) {
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
        if (project.settings.sqlconnector.user) {
          options.auth = Object.assign({}, options.auth, {
            user: project.settings.sqlconnector.user,
          });
        }
        if (project.settings.sqlconnector.password) {
          options.auth = Object.assign({}, options.auth, {
            password: project.settings.sqlconnector.password,
          });
        }

        // Build the base url.
        options.url = `${project.settings.sqlconnector.host}/${settings.table}`;

        // If this was not a post request, determine which existing resource we are modifying.
        if (method !== 'post') {
          const externalId = getSubmissionId(req, res);
          if (externalId !== undefined) {
            options.url += `/${externalId}`;
          }
        }

        // If this is a create/update, determine what to send in the request body.
        if (['post', 'put'].includes(method)) {
          options.json = true;
          const item = res.resource
            ? res.resource.item.toObject()
            : req.body;

          // Remove protected fields from the external request.
          formio.util.removeProtectedFields(req.currentForm, method, item);
          options.body = item;
        }

        options.timeout = 10000;
        process.nextTick(() => request(options)
          .then((response) => {
            // If this is not a new resource, skip link phase for new resources.
            if (method !== 'post') {
              // if the request was blocking, return here.
              if (settings.block === true) {
                return next();
              }
              return;
            }

            if (!response) {
              throw new Error('Invalid response.');
            }

            if (!(response.status >= 200 && response.status < 300)) {
              throw new Error((response.body || '').toString().replace(/<br>/, ''));
            }

            const results = response.rows;

            if (!Array.isArray(results)) {
              // No clue what to do here.
              throw new Error(`Expected array of results, got ${typeof results}(${JSON.stringify(results)})`);
            }

            if (results.length > 1) {
              throw new Error(`More than one result: ${results.length}`);
            }

            // 'Save submission' action is set.
            if (method === 'post' && res.resource) {
              const remoteItem = results[0];
              const localId = res.resource.item._id;
              if (!localId) {
                throw new Error(`Unknown local item id: ${localId}`);
              }
              // Get the remoteId
              const remoteId = remoteItem[primaryKey];
              if (_.isNil(remoteId)) {
                throw new Error(`Unknown remote item id (${remoteId}) for primary key.`);
              }

              return addExternalId(localId, remoteId);
            }
          })
          // If blocking is on, return the error.
          .then(() => {
            // if the request was blocking, return here.
            if (settings.block === true) {
              return next();
            }
          })
          .catch(handleErrors)
        );
      }
      catch (err) {
        return handleErrors(err);
      }
    }
  }

  // Return the SQLConnector.
  return SQLConnector;
};
