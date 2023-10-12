'use strict';

const fetch = require('formio/src/util/fetch');
const _ = require('lodash');
const vmUtil = require('vm-utils');

const {isEmptyObject} = require('../../util/util');
const {
  getSubmission,
  getExternalId,
  writeExternalIdToSubmission,
  constructHeadersObject,
  processWebhookResponseBody,
} = require('./util');

module.exports = (router) => {
  const Action = router.formio.Action;
  const hook = router.formio.hook;
  const interpolateFn = router.formio.util.FormioUtils.interpolate;

  /**
   * WebhookAction class.
   *   This class is used to create webhook interface.
   */
  class WebhookAction extends Action {
    static info(req, res, next) {
      next(
        null,
        hook.alter('actionInfo', {
          name: 'webhook',
          title: 'Webhook',
          description: 'Allows you to trigger an external interface.',
          priority: 0,
          defaults: {
            handler: ['after'],
            method: ['create', 'update', 'delete'],
          },
        })
      );
    }

    static settingsForm(req, res, next) {
      next(null, [
        {
          clearOnHide: false,
          label: 'Columns',
          input: false,
          key: 'columns',
          columns: [
            {
              components: [
                {
                  input: true,
                  label: 'Request Method',
                  key: 'method',
                  placeholder: 'Match',
                  data: {
                    values: [
                      {
                        value: '',
                        label: 'Match',
                      },
                      {
                        value: 'get',
                        label: 'GET',
                      },
                      {
                        value: 'post',
                        label: 'POST',
                      },
                      {
                        value: 'put',
                        label: 'PUT',
                      },
                      {
                        value: 'delete',
                        label: 'DELETE',
                      },
                      {
                        value: 'patch',
                        label: 'PATCH',
                      },
                    ],
                  },
                  dataSrc: 'values',
                  valueProperty: 'value',
                  template: '<span>{{ item.label }}</span>',
                  persistent: true,
                  type: 'select',
                  description:
                    'If set to Match it will use the same Request Type as sent to the Form.io server.',
                },
              ],
              width: 2,
              offset: 0,
              push: 0,
              pull: 0,
            },
            {
              components: [
                {
                  label: 'Request URL',
                  key: 'url',
                  inputType: 'text',
                  defaultValue: '',
                  input: true,
                  placeholder: 'http://myreceiver.com/something.php',
                  prefix: '',
                  suffix: '',
                  type: 'textfield',
                  multiple: false,
                  validate: {
                    required: true,
                  },
                  description:
                    'The URL the request will be made to. You can interpolate the URL with <b>data.myfield</b>, <b>externalId</b> or <b>submission</b> variables.',
                },
              ],
              width: 10,
              offset: 0,
              push: 0,
              pull: 0,
            },
          ],
          type: 'columns',
        },
        {
          key: 'panel1',
          input: false,
          tableView: false,
          title: 'HTTP Headers',
          components: [
            {
              type: 'checkbox',
              persistent: true,
              protected: false,
              defaultValue: false,
              key: 'forwardHeaders',
              label: 'Forward headers',
              tooltip: 'Pass on any headers received by the form.io server.',
              hideLabel: false,
              inputType: 'checkbox',
              input: true,
            },
            {
              key: 'fieldset',
              input: false,
              tableView: false,
              legend: 'HTTP Basic Authentication (optional)',
              components: [
                {
                  label: 'Authorize User',
                  key: 'username',
                  inputType: 'text',
                  defaultValue: '',
                  input: true,
                  placeholder: 'User for Basic Authentication',
                  type: 'textfield',
                  multiple: false,
                  autocomplete: 'off',
                },
                {
                  label: 'Authorize Password',
                  key: 'password',
                  inputType: 'password',
                  defaultValue: '',
                  input: true,
                  placeholder: 'Password for Basic Authentication',
                  type: 'textfield',
                  multiple: false,
                  autocomplete: 'off',
                },
              ],
              type: 'fieldset',
              label: 'fieldset',
            },
            {
              input: true,
              tree: true,
              components: [
                {
                  input: true,
                  tableView: true,
                  inputType: 'text',
                  label: 'Header',
                  key: 'header',
                  protected: false,
                  persistent: true,
                  clearOnHide: true,
                  type: 'textfield',
                  inDataGrid: true,
                },
                {
                  input: true,
                  tableView: true,
                  inputType: 'text',
                  label: 'Value',
                  key: 'value',
                  protected: false,
                  persistent: true,
                  clearOnHide: true,
                  type: 'textfield',
                  inDataGrid: true,
                },
              ],
              label: 'Additional Headers',
              key: 'headers',
              persistent: true,
              type: 'datagrid',
              addAnother: 'Add Header',
            },
          ],
          type: 'panel',
          label: 'Panel',
        },
        {
          key: 'panel2',
          input: false,
          tableView: false,
          title: 'Request Payload',
          components: [
            {
              key: 'content',
              input: false,
              html: '<p>By default the request payload will contain an object with the following information:</p> <div style="background:#eeeeee;border:1px solid #cccccc;padding:5px 10px;">{<br /> &nbsp;&nbsp;request: request, // an object containing request body to the form.io server.<br /> &nbsp;&nbsp;submission: submission, // an object containing the submission object from the request.<br /> &nbsp;&nbsp;params: params, // an object containing the params for the request such as query parameters or url parameters.<br /> }</div> <p>You can use the transform payload javascript to modify the contents of the payload that will be send in this webhook. The following variables are also available: headers</p>',
              type: 'content',
              label: 'content',
            },
            {
              autofocus: false,
              input: true,
              tableView: true,
              label: 'Transform Payload',
              key: 'transform',
              placeholder:
                '/** Example Code **/\npayload = payload.submission.data;',
              rows: 8,
              multiple: false,
              defaultValue: '',
              protected: false,
              persistent: true,
              hidden: false,
              wysiwyg: false,
              spellcheck: true,
              type: 'textarea',
              description:
                'Available variables are payload, externalId, and headers.',
            },
          ],
          type: 'panel',
          label: 'Panel',
        },
        {
          key: 'panel3',
          type: 'panel',
          title: 'Response Payload',
          input: false,
          components: [
            {
              type: 'checkbox',
              persistent: true,
              protected: false,
              defaultValue: false,
              key: 'block',
              label: 'Wait for webhook response before continuing actions',
              hideLabel: false,
              inputType: 'checkbox',
              input: true,
            },
            {
              key: 'content',
              input: false,
              html: '<p>When making a request to an external service, you may want to save an external Id in association with this submission so you can refer to the same external resource later. To do that, enter an external ID reference name and the path to the id in the response data object. This value will then be available as <b>externalId</b> in the Request URL and Transform Payload fields.</p>',
              type: 'content',
              label: 'content',
            },
            {
              input: true,
              inputType: 'text',
              label: 'External Id Type',
              key: 'externalIdType',
              multiple: false,
              protected: false,
              unique: false,
              persistent: true,
              type: 'textfield',
              description:
                'The name to store and reference the external Id for this request',
            },
            {
              input: true,
              inputType: 'text',
              label: 'External Id Path',
              key: 'externalIdPath',
              multiple: false,
              protected: false,
              clearOnHide: true,
              type: 'textfield',
              description:
                'The path to the data in the webhook response object',
            },
          ],
        },
      ]);
    }

    /**
     * Trigger the webhook.
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
    async resolve(handler, method, req, res, next, setActionItemMessage) {
      const settings = this.settings || {};
      const submission = getSubmission(req, res);
      const externalId = getExternalId(submission, settings);
      const shouldBlock = !!settings.block;

      /**
       * Util function to handle success for a potentially blocking request.
       *
       * @param data
       * @param response
       * @returns {*}
       */
      const handleSuccess = (data) => {
        setActionItemMessage('Webhook succeeded');
        const hasExternalIdSettings = !!(
          settings.externalIdType && settings.externalIdPath
        );
        const resourceExists = !!(res && res.resource && res.resource.item);

        let type, id;
        if (hasExternalIdSettings) {
          type = settings.externalIdType;
          id = _.get(data, settings.externalIdPath, '');
          if (resourceExists) {
            writeExternalIdToSubmission(req, res, router, type, id);
          }
        }

        if (!shouldBlock) {
          return;
        }

        // Return webhook's response in submission response metadata
        if (handler === 'before') {
          if (hasExternalIdSettings) {
            req.body.externalIds = req.body.externalIds
              ? [...req.body.externalIds, {type, id}]
              : [{type, id}];
          }
          req.body.metadata = {...req.body.metadata, [this.title]: data};
        }

        // Optimistically update externalIds in the submission response object and write webhook response to metadata
        // NOTE: The externalId will have a stale ObjectID due to Proxy setters
        if (handler === 'after' && resourceExists) {
          if (hasExternalIdSettings) {
            res.resource.item.externalIds = res.resource.item.externalIds
              ? [...res.resource.item.externalIds, {type, id}]
              : [{type, id}];
          }
          res.resource.item.metadata = {
            ...res.resource.item.metadata,
            [this.title]: data,
          };
        }
        return next();
      };

      /**
       * Util function to handle errors for a potentially blocking request.
       *
       * @param data
       * @param response
       * @returns {*}
       */
      const handleError = (data, response = {}) => {
        setActionItemMessage('Webhook failed', {data, response}, 'error');
        if (!shouldBlock) {
          return;
        }

        const message = isEmptyObject(data)
          ? response.statusText
          : data.message || data;
        return res
          .status(response && response.status ? response.status : 400)
          .json(message);
      };

      try {
        if (!hook.alter('resolve', true, this, handler, method, req, res)) {
          setActionItemMessage('Webhook skipped (resolved)');
          return next();
        }

        // Continue if we're not blocking
        if (!shouldBlock) {
          next(); // eslint-disable-line callback-return
        }

        // Can't send a webhook if the url isn't set.
        if (!settings.url) {
          return handleError('No url given in the settings');
        }

        let url = settings.url;
        let headers = constructHeadersObject(req, settings);

        const interpolationContext = {
          ...(submission.data ? submission.data : {}), // Legacy support for interpolation.
          config:
            req.currentProject && req.currentProject.hasOwnProperty('config')
              ? req.currentProject.config
              : {},
          data: submission.data ? submission.data : {},
          submission,
          externalId,
        };

        url = interpolateFn(url, interpolationContext);
        headers = Object.entries(headers).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: interpolateFn(value, interpolationContext),
          }),
          {}
        );

        // Fall back if interpolation failed
        if (!url) {
          url = settings.url;
        }

        // Let the user know if any of their headers were unable to be interpolated
        Object.entries(headers).forEach(([key, value]) => {
          if (value === 'undefined') {
            setActionItemMessage(`Header interpolation failed`, {[key]: value}, 'error');
          }
        });

        // Use either the method specified in settings or the request method.
        const reqMethod = (settings.method || req.method).toLowerCase();
        if (reqMethod === 'delete') {
          const parsedUrl = new URL(url);
          const query = parsedUrl.search;

          if (query) {
            const queryParams = Object.fromEntries(new URLSearchParams(query));
            req.params = {...req.params, ...queryParams};
            url = url.replace(query, '');
          }
        }

        // Check for infinite loop webhook action
        const formIds = req.headers['form-ids']
          ? req.headers['form-ids'].split(',')
          : [];
        const formNames = req.headers['form-names']
          ? req.headers['form-names'].split(',')
          : [];
        if (formIds.some((id) => url.includes(id))) {
          return next();
        }
        if (formNames.some((name) => url.toLowerCase().includes(name))) {
          return next();
        }
        if (req.currentForm) {
          formIds.push(req.currentForm._id.toString());
          formNames.push(req.currentForm.path);
          headers['form-ids'] = formIds.join(',');
          headers['form-names'] = formNames.join(',');
        }

        let payload = {
          request: req.body,
          submission,
          params: req.params,
        };

        // Allow user scripts to transform the payload.
        setActionItemMessage('Transforming payload');
        if (settings.transform) {
          try {
            const isolate = vmUtil.getIsolate();
            const context = await isolate.createContext();
            await vmUtil.transfer('externalId', externalId, context);
            await vmUtil.transfer('payload', payload, context);
            await vmUtil.transfer('headers', headers, context);
            await vmUtil.transfer(
              'config',
              req.currentProject && req.currentProject.hasOwnProperty('config') ?
              req.currentProject.config : {},
              context
            );
            // Assign transfromed data to payload variable in sandbox
            await context.eval(settings.transform, {
              timeout: 500,
              copy: true
            });
            // Retrieve payload
            payload = await context.eval(`payload`, {copy: true, timeout: 500});
          }
          catch (err) {
            setActionItemMessage('Webhook transform failed', err, 'error');
          }
        }
        setActionItemMessage('Transform payload done');

        const options = {
          method: reqMethod,
          rejectUnauthorized: false, // allow self-signed certs
          headers,
        };

        setActionItemMessage('Attempting webhook', {
          method: reqMethod,
          url,
          options,
        });

        if (['post', 'put', 'patch'].includes(reqMethod)) {
          options.body = JSON.stringify(payload);
        }

        const isDeleteRequest = reqMethod === 'delete';
        if (isDeleteRequest) {
          options.qs = req.params;
          options.body = JSON.stringify(payload);
        }

        // Make the request
        const fetchRequest = fetch(url, options);
        const processResponseBody = fetchRequest.then((response) =>
          processWebhookResponseBody(response, isDeleteRequest)
        );

        // Set up closures
        const result = Promise.all([fetchRequest, processResponseBody]);
        const onResolve = ([response, body]) =>
          response.ok ? handleSuccess(body) : handleError(body, response);
        const onError = (err) => handleError(err);

        return result.then(onResolve).catch(onError);
      }
      catch (e) {
        handleError(e);
      }
    }
  }

  // Return the WebhookAction.
  return WebhookAction;
};
