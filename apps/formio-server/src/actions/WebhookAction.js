'use strict';

const rest = require('restler');
const _ = require('lodash');
const vm = require('vm');

const util = require('./util');

module.exports = (router) => {
  const Action = router.formio.Action;
  const hook = router.formio.hook;

  /**
   * WebhookAction class.
   *   This class is used to create webhook interface.
   */
  class WebhookAction extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

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
                  description: 'The URL the request will be made to. You can interpolate the URL with {{ data.myfield }} or {{ externalId }} variables.'
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
                  multiple: false
                },
                {
                  label: 'Authorize Password',
                  key: 'password',
                  inputType: 'password',
                  defaultValue: '',
                  input: true,
                  placeholder: 'Password for Basic Authentication',
                  type: 'textfield',
                  multiple: false
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
              html: '<p>By default the request payload will contain an object with the following information:</p> <div style="background:#eeeeee;border:1px solid #cccccc;padding:5px 10px;">{<br /> &nbsp;&nbsp;request: request, // an object containing request body to the form.io server.<br /> &nbsp;&nbsp;response: response, // an object containing the server response from the form.io server.<br /> &nbsp;&nbsp;submission: submission, // an object containing the submission object from the request.<br /> &nbsp;&nbsp;params: params, // an object containing the params for the request such as query parameters or url parameters.<br /> }</div> <p>You can use the transform payload javascript to modify the contents of the payload that will be send in this webhook. The following variables are also available: headers</p>',
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
              html: '<p>When making a request to an external service, you may want to save an external Id in association with this submission so you can refer to the same external resource later. To do that, enter an external ID reference name and the path to the id in the response data object. This value will then be available as {{externalId}} in the Request URL and Transform Payload fields.</p>',
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
     * Trigger the webhooks.
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
    /* eslint-disable max-statements */
    resolve(handler, method, req, res, next, setActionItemMessage) {
      const settings = this.settings || {};

      /**
       * Util function to handle success for a potentially blocking request.
       *
       * @param data
       * @param response
       * @returns {*}
       */
      const handleSuccess = (data, response) => {
        setActionItemMessage('Webhook succeeded');
        if (settings.externalIdType && settings.externalIdPath) {
          const type = settings.externalIdType;
          const id = data[settings.externalIdPath] || '';

          util.setCustomExternalIdType(req, res, router, type, id);
        }

        if (!settings.block || settings.block === false) {
          return;
        }

        // Return response in metadata
        if (res && res.resource && res.resource.item) {
          res.resource.item.metadata = res.resource.item.metadata || {};
          res.resource.item.metadata[this.title] = data;
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
        if (!settings.block || settings.block === false) {
          return;
        }

        const message = data ? (data.message || data) : response.statusMessage;

        return res.status(response.status || 400).send(message);
      };

      try {
        if (!hook.alter('resolve', true, this, handler, method, req, res)) {
          setActionItemMessage('Webhook skipped (resolved)');
          return next();
        }

        // Continue if were not blocking
        if (!settings.block || settings.block === false) {
          next(); // eslint-disable-line callback-return
        }

        const submission = _.get(res, 'resource.previousItem') || _.get(res, 'resource.item') || {};
        const externalId = submission[settings.externalIdType || 'none'] || '';

        const options = {};

        // Get the settings
        if (settings.username) {
          options.username = settings.username;
        }
        if (settings.password) {
          options.password = settings.password;
        }

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
        // Always set user agent to indicate it came from us.
        options.headers['user-agent'] = 'Form.io Webhook Action';

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
        if (res && res.resource && res.resource.item && res.resource.item.data) {
          // Interpolation data was originally just the data object itself. We have to move it to "data" so merge it as the root item.
          const params = {
            ...res.resource.item.data, // Legacy support for interpolation.
            config: req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {},
            data: res.resource.item.data,
            externalId
          };
          url = router.formio.util.FormioUtils.interpolate(url, params);
        }
        // Fall back if interpolation failed
        if (!url) {
          url = settings.url;
        }

        let payload = {
          request: req.body,
          response: req.response,
          submission: (submission && submission.toObject) ? submission.toObject() : {},
          params: req.params
        };

        // Allow user scripts to transform the payload.
        setActionItemMessage('Transforming payload');
        if (settings.transform) {
          const script = new vm.Script(settings.transform);
          const sandbox = {
            externalId,
            payload,
            headers: options.headers,
            config: req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {},
          };
          script.runInContext(vm.createContext(sandbox), {
            timeout: 500
          });
          payload = sandbox.payload;
        }
        setActionItemMessage('Transform payload done');

        // Use either the method specified in settings or the request method.
        const reqMethod = settings.method || req.method;

        setActionItemMessage('Attempting webhook', {
          method: reqMethod,
          url,
          options
        });
        // Make the request.
        switch (reqMethod.toLowerCase()) {
          case 'get':
            rest
              .get(url, options)
              .on('success', handleSuccess)
              .on('fail', handleError)
              .on('error', handleError);
            break;
          case 'post':
            rest
              .postJson(url, payload, options)
              .on('success', handleSuccess)
              .on('fail', handleError)
              .on('error', handleError);
            break;
          case 'put':
            rest
              .putJson(url, payload, options)
              .on('success', handleSuccess)
              .on('fail', handleError)
              .on('error', handleError);
            break;
          case 'patch':
            rest
              .patchJson(url, payload, options)
              .on('success', handleSuccess)
              .on('fail', handleError)
              .on('error', handleError);
            break;
          case 'delete':
            options.query = req.params;
            rest
              .del(url, options)
              .on('success', handleSuccess)
              .on('fail', handleError)
              .on('error', handleError);
            break;
          default:
            return handleError(`Could not match request method: ${req.method.toLowerCase()}`);
        }
      }
      catch (e) {
        handleError(e);
      }
    }
  }

  // Return the WebhookAction.
  return WebhookAction;
};
