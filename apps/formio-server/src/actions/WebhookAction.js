'use strict';

const fetch = require('formio/src/util/fetch');
const _ = require('lodash');
const {NodeVM, VMScript} = require('vm2');

const util = require('./util');

module.exports = (router) => {
  const Action = router.formio.Action;
  const hook = router.formio.hook;

  /**
   * WebhookAction class.
   *   This class is used to create webhook interface.
   */
  class WebhookAction extends Action {
    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'webhook',
        title: 'Webhook',
        description: 'Allows you to trigger an external interface.',
        priority: 0,
        defaults: {
          handler: ['after'],
          method: ['create', 'update', 'delete']
        }
      }));
    }
    /* eslint-disable max-len */
    static settingsForm(req, res, next) {
      next(null, [
        {
          clearOnHide: false,
          label: "Columns",
          input: false,
          key: "columns",
          columns: [
            {
              components: [
                {
                  input: true,
                  label: "Request Method",
                  key: "method",
                  placeholder: "Match",
                  data: {
                    values: [
                      {
                        value: "",
                        label: "Match"
                      },
                      {
                        value: "get",
                        label: "GET"
                      },
                      {
                        value: "post",
                        label: "POST"
                      },
                      {
                        value: "put",
                        label: "PUT"
                      },
                      {
                        value: "delete",
                        label: "DELETE"
                      },
                      {
                        value: "patch",
                        label: "PATCH"
                      }
                    ],
                  },
                  dataSrc: "values",
                  valueProperty: "value",
                  template: "<span>{{ item.label }}</span>",
                  persistent: true,
                  type: "select",
                  description: "If set to Match it will use the same Request Type as sent to the Form.io server."
                }
              ],
              width: 2,
              offset: 0,
              push: 0,
              pull: 0
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
                    required: true
                  },
                  description: 'The URL the request will be made to. You can interpolate the URL with <b>data.myfield</b>, <b>externalId</b> or <b>submission</b> variables.'
                },

              ],
              width: 10,
              offset: 0,
              push: 0,
              pull: 0
            }
          ],
          type: "columns",
        },
        {
          key: 'panel1',
          input: false,
          tableView: false,
          title: "HTTP Headers",
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
              input: true
            },
            {
              key: "fieldset",
              input: false,
              tableView: false,
              legend: "HTTP Basic Authentication (optional)",
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
                  autocomplete: 'off'
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
                  autocomplete: 'off'
                }
              ],
              type: "fieldset",
              label: "fieldset"
            },
            {
              input: true,
              tree: true,
              components: [
                {
                  input: true,
                  tableView: true,
                  inputType: "text",
                  label: "Header",
                  key: "header",
                  protected: false,
                  persistent: true,
                  clearOnHide: true,
                  type: "textfield",
                  inDataGrid: true,
                },
                {
                  input: true,
                  tableView: true,
                  inputType: "text",
                  label: "Value",
                  key: "value",
                  protected: false,
                  persistent: true,
                  clearOnHide: true,
                  type: "textfield",
                  inDataGrid: true,
                }
              ],
              label: "Additional Headers",
              key: "headers",
              persistent: true,
              type: "datagrid",
              addAnother: "Add Header"
            },
          ],
          type: "panel",
          label: "Panel"
        },
        {
          key: 'panel2',
          input: false,
          tableView: false,
          title: "Request Payload",
          components: [
            {
              key: "content",
              input: false,
              html: '<p>By default the request payload will contain an object with the following information:</p> <div style="background:#eeeeee;border:1px solid #cccccc;padding:5px 10px;">{<br /> &nbsp;&nbsp;request: request, // an object containing request body to the form.io server.<br /> &nbsp;&nbsp;submission: submission, // an object containing the submission object from the request.<br /> &nbsp;&nbsp;params: params, // an object containing the params for the request such as query parameters or url parameters.<br /> }</div> <p>You can use the transform payload javascript to modify the contents of the payload that will be send in this webhook. The following variables are also available: headers</p>',
              type: "content",
              label: "content",
            },
            {
              autofocus: false,
              input: true,
              tableView: true,
              label: "Transform Payload",
              key: "transform",
              placeholder: "/** Example Code **/\npayload = payload.submission.data;",
              rows: 8,
              multiple: false,
              defaultValue: "",
              protected: false,
              persistent: true,
              hidden: false,
              wysiwyg: false,
              spellcheck: true,
              type: "textarea",
              description: "Available variables are payload, externalId, and headers."
            }
          ],
          type: "panel",
          label: "Panel"
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
              input: true
            },
            {
              key: "content",
              input: false,
              html: '<p>When making a request to an external service, you may want to save an external Id in association with this submission so you can refer to the same external resource later. To do that, enter an external ID reference name and the path to the id in the response data object. This value will then be available as <b>externalId</b> in the Request URL and Transform Payload fields.</p>',
              type: "content",
              label: "content",
            },
            {
              input: true,
              inputType: "text",
              label: "External Id Type",
              key: "externalIdType",
              multiple: false,
              protected: false,
              unique: false,
              persistent: true,
              type: "textfield",
              description: "The name to store and reference the external Id for this request",
            },
            {
              input: true,
              inputType: "text",
              label: "External Id Path",
              key: "externalIdPath",
              multiple: false,
              protected: false,
              clearOnHide: true,
              type: "textfield",
              description: "The path to the data in the webhook response object",
            }
          ]
        }
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
    resolve(handler, method, req, res, next, setActionItemMessage) {
      const settings = this.settings || {};
      const shouldBlock = !!(settings.block);
      const hasExternalIdSettings = !!(settings.externalIdType && settings.externalIdPath);

      /**
       * Util function to handle success for a potentially blocking request.
       *
       * @param data
       * @param response
       * @returns {*}
       */
      const handleSuccess = (data) => {
        setActionItemMessage('Webhook succeeded');

        const resourceExists = !!(res && res.resource && res.resource.item);

        let type, id;
        if (hasExternalIdSettings) {
          type = settings.externalIdType;
          id = _.get(data, settings.externalIdPath, '');
          if (resourceExists) {
            util.writeExternalIdToSubmission(req, res, router, type, id);
          }
          // TODO: We may consider if a non-blocking `before` webhook returns quickly enough we may have time to write externalIds to
          // the resourcejs model here via the req object; my concern here is that a very expensive non-blocking webhook might resolve to this
          // function well after the req-res cycle is over and at this moment I can't guarantee the stability of the req object in that case
        }

        if (!shouldBlock) {
          return;
        }

        // Return webhook's response in submission response metadata
        if (handler === 'before') {
            if (hasExternalIdSettings) {
              req.body.externalIds = req.body.externalIds ? [...req.body.externalIds, {type, id}] : [{type, id}];
            }
            req.body.metadata = {...req.body.metadata, [this.title]: data};
        }

        // Optimistically update externalIds in the submission response object and write webhook response to metadata
        // NOTE: The externalId will have a stale ObjectID due to Proxy setters
        if (handler === 'after' && resourceExists) {
          if (hasExternalIdSettings) {
            res.resource.item.externalIds = res.resource.item.externalIds ? [...res.resource.item.externalIds, {type, id}] : [{type, id}];
          }
          res.resource.item.metadata = {...res.resource.item.metadata, [this.title]: data};
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

        const message = !_.isEmpty(data) ? (data.message || data) : response.statusText;

        return res.status((response && response.status) ? response.status : 400).send(message);
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

        const submission = _.get(res, 'resource.previousItem') || _.get(res, 'resource.item') || {};
        const externalIds = submission.externalIds || [];
        let externalId = '';
        const externalIdType = settings.externalIdType || 'none';

        externalIds.forEach((external) => {
          if (external.type === externalIdType && external.id) {
            externalId = external.id;
          }
        });

        const options = {};

        if (settings.forwardHeaders) {
          options.headers = _.clone(req.headers);

          // Delete headers that shouldn't be forwarded.
          delete options.headers['host'];
          delete options.headers['content-length'];
          delete options.headers['content-type'];
          delete options.headers['connection'];
          delete options.headers['cache-control'];
        }
        else {
          options.headers = {
            'Accept': '*/*'
          };
        }

        if (settings.username && settings.password) {
          const auth = Buffer.from(`${settings.username}:${settings.password}`).toString('base64');
          options.headers['Authorization'] = `Basic ${auth}`;
        }

        // Always set user agent to indicate it came from us.
        options.headers['user-agent'] = 'Form.io Webhook Action';
        options.headers['content-type'] = 'application/json';

        // Add custom headers.
        const headers = settings.headers || [];
        headers.forEach((header) => {
          if (header && header.header) {
            options.headers[header.header] = header.value;
          }
        });

        // Can't send a webhook if the url isn't set.
        if (!settings.url) {
          return handleError('No url given in the settings');
        }

        let url = settings.url;

        // Interpolate URL if possible
        if (res && res.resource &&
          (res.resource.item && res.resource.item.data || res.resource.previousItem && res.resource.previousItem.data)
          ) {
          // Interpolation data was originally just the data object itself. We have to move it to "data" so merge it as the root item.
          const itemData = res.resource.item ? res.resource.item.data : res.resource.previousItem.data;
          const params = {
            ...itemData, // Legacy support for interpolation.
            config: req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {},
            data: res.resource.item.data || res.resource.previousItem.data,
            submission: (submission && submission.toObject) ? submission.toObject() : {},
            externalId
          };
          url = router.formio.util.FormioUtils.interpolate(url, params);
        }
        // Fall back if interpolation failed
        if (!url) {
          url = settings.url;
        }

        const formIds = req.headers['form-ids']
          ? req.headers['form-ids'].split(',')
          : [];
        const formNames = req.headers['form-names']
          ? req.headers['form-names'].split(',')
          : [];

        if (formIds.some(id => url.includes(id))) {
          return next();
        }

        if (formNames.some(name => url.toLowerCase().includes(name))) {
          return next();
        }

        if (req.currentForm) {
          formIds.push(req.currentForm._id.toString());
          formNames.push(req.currentForm.path);
          options.headers['form-ids'] = formIds.join(',');
          options.headers['form-names'] = formNames.join(',');
        }

        let payload = {
          request: req.body,
          // if we're in a before handler e.g., submission will be empty, so fallback to a clone of req.body to increase usability
          submission: (submission && submission.toObject) ? submission.toObject() : _.cloneDeep(req.body),
          params: req.params
        };

        // Allow user scripts to transform the payload.
        setActionItemMessage('Transforming payload');
        if (settings.transform) {
          const script = new VMScript(`${settings.transform} \n module.exports = payload;`);
          try {
            payload = (new NodeVM({
              timeout: 500,
              sandbox: _.cloneDeep({
                externalId,
                payload,
                headers: options.headers,
                config: req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {},
              }),
              eval: false,
              fixAsync: true
            })).run(script);
          }
          catch (err) {
            setActionItemMessage('Webhook transform failed', err, 'error');
          }
        }
        setActionItemMessage('Transform payload done');

        // Use either the method specified in settings or the request method.
        const reqMethod = (settings.method || req.method).toLowerCase();
        options.method = reqMethod;
        options.rejectUnauthorized = false;

        setActionItemMessage('Attempting webhook', {
          method: reqMethod,
          url,
          options
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
          util.processWebhookResponseBody(response, isDeleteRequest)
        );

        // Set up closures
        const result = Promise.all([fetchRequest, processResponseBody]);
        const onResolve = (([response, body]) => response.ok ? handleSuccess(body) : handleError(body, response));
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
