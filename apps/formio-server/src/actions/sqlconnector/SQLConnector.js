'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:action:sqlconnector');
const fetch = require('@formio/node-fetch-http-proxy');
const config = require('../../../config');

module.exports = (router) => {
  const Action = router.formio.Action;
  const formio = router.formio;
  const hook = formio.hook;

  /**
   * Add an externalId to the local resource with the remote id.
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

    return formio.resources.submission.model.updateOne(find, update);
  }

  /**
   * Get the externalId for the current submission.
   * @param {import('express').Request} req
   *   The express request object.
   * @param {import('express').Response} res
   *   The express response object.
   * @returns {string|null}
   *   The external id for the sqlconnector in the submission if defined.
   */
  function getSubmissionId(req, res) {
    // We need to retrieve the externalIds for update, and delete ops. Limit need to fetch from db.
    // formioCache and the previousSubmission were more consistently available than previous options.
    const external = (
      req.formioCache.submissions[req.subId] ||
      req.previousSubmission ||
      res.resource?.item ||
      res.resource?.previousItem
    )?.externalIds.find((item) => item.type === 'sqlconnector');

    // External has be found let's return
    if (external) {
      return external.id;
    }

    // Only perform the async op if external is still not found. Uphold synchronization.
    // Only time wouldn't be found is if someone as manually deleted from db.
    return formio.resources.submission.model
      .findOne({_id: formio.util.ObjectId(req.subId)})
      .exec()
      .then((fallBack) => {
        if (fallBack) {
          fallBack = fallBack.toObject();

          const external = fallBack.externalIds?.find((item) => item.type === 'sqlconnector');
          return external ? external.id : null;
        }
        return null;
      })
      .catch((err) => {
        debug(err);
        return null;
      });
  }

  /**
   * SQLConnector class.
   *   This class is used to integrate into external SQL Databases.
   */
  class SQLConnector extends Action {
    /**
     * @param {import('express').Request} req
     *   The Express request object.
     * @param {import('express').Response} res
     *   The Express response object.
     * @param {import('express').NextFunction} next
     *   The callback function to execute upon completion.
     */
    static info(req, res, next) {
      if (config.formio.hosted) {
        return next(null);
      }
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

    static async settingsForm(req, res, next) {
      try {
        let settings = await hook.settings(req);
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

        try {
          // Load the current form, to get all the components.
          const currentForm = await formio.cache.loadCurrentForm(req);

          // Filter non-input components.
          const components = [];
          formio.util.eachComponent(currentForm.components, (component) => {
            if (
              !formio.util.isLayoutComponent(component) &&
              component.input === true &&
              component.type !== 'button' &&
              component.type !== 'email'
            ) {
              components.push(component);
            }
          });

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
        }
        catch (err) {
          return next('Could not load the settings form.');
        }
      }
      catch (err) {
        debug(err);
        return next(null, {});
      }
    }

    /**
     * Trigger the Resquel request.
     *
     * @param handler
     * @param method
     * @param {import('express').Request} req
     *   The Express request object.
     * @param {import('express').Response} res
     *   The Express response object.
     * @param {import('express').NextFunction} next
     *   The callback function to execute upon completion.
     */
    resolve(handler, method, req, res, next) {
      const settings = this.settings || {};

      // Only block on the external request, if configured
      if (!settings.block || settings.block === false) {
        next(); // eslint-disable-line callback-return
      }

      function handleErrors(err) {
        debug(err);

        // If server is not running 502 error is more appropriate than 400
        if (err.code === 'ECONNREFUSED') {
          return res.status(502).json({
            status: 502,
            message: err.message
          });
        }

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

          return formio.resources.submission.model.updateOne(find, update).exec()
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
          rejectUnauthorized: false,
        };

        const primaryKey = this.settings.primary;
        const project = formio.cache.currentProject(req);
        if (_.isNil(project)) {
          return handleErrors('No project found.');
        }

        // Add basic auth if available.
        if (project.settings.sqlconnector.user && project.settings.sqlconnector.password) {
          const auth = Buffer.from(`${project.settings.sqlconnector.user}:${project.settings.sqlconnector.password}`).toString('base64');
          options.headers = {
            'Authorization': `Basic ${auth}`
          };
        }

        // Build the base url.
        let url = `${project.settings.sqlconnector.host}/${settings.table}`;

        // If this was not a post request, determine which existing resource we are modifying.
        if (method !== 'post') {
          const externalId = getSubmissionId(req, res);
          if (externalId !== undefined) {
            url += `/${externalId}`;
          }
        }

        // If this is a create/update, determine what to send in the request body.
        if (['post', 'put'].includes(method)) {
          let item = res.resource
            ? res.resource.item
            : req.body;

          try {
            item = item.toObject();
          }
          catch (err) {
            // item is already an object.
          }

          // Remove protected fields from the external request.
          formio.util.removeProtectedFields(req.currentForm, method, item);
          options.body = JSON.stringify(item);

          options.headers = options.headers || {};
          options.headers['content-type'] = 'application/json';
        }

        options.timeout = 10000;
        process.nextTick(() => fetch(url, options)
          .then(async (response) => {
            // If this is not a new resource, skip link phase for new resources.
            if (method !== 'post') {
              // if the request was blocking, return here.
              if (settings.block === true) {
                return next();
              }
              return;
            }

            if (!response.ok) {
              return response.text().then(text => {
                throw new Error(text);
              });
            }

            const body = await response.json();
            const results = body.rows;

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
            // Runs beforePost, ensuring externalId is created after postSubmissionUpdate
            else {
              res.submission['externalIds'] = [];
              res.submission.externalIds.push({type: "sqlconnector", id: results[0].id});
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
