/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const _ = require('lodash');
const speakeasy = require('speakeasy');

function get2FaCode(secretKey) {
  return speakeasy.totp({secret: secretKey, encoding: 'base32'});
}

module.exports = function(app, template, hook) {

  describe('Two-Factor Authentication', function() {
    const USER_EMAIL = 'user2fa@test.com';
    const USER_PASSWORD = 'user2fatest';

    describe('Bootstrap', function() {
      it('Create 2Fa login form', function(done) {
        const form = {
          noSave: true,
          title: 'Two-Factor Authentication Form',
          type: 'form',
          name: 'twoFaLoginForm',
          path: 'user/twofaloginform',
          display: 'form',
          components: [
            {
              label: 'Code',
              inputMask: '999999',
              autofocus: true,
              tableView: true,
              validate: {
                required: true,
                minLength: 6,
                maxLength: 6,
              },
              key: 'token',
              type: 'textfield',
              input: true,
            },
            {
              label: 'Submit',
              showValidations: false,
              block: true,
              disableOnInvalid: true,
              tableView: false,
              key: 'submit',
              type: 'button',
              input: true,
            },
          ],
          access: template.forms.userLogin.access,
          submissionAccess: template.forms.userLogin.submissionAccess,
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(form)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
            assert.equal(response.title, form.title);
            assert.equal(response.name, form.name);
            assert.equal(response.path, form.path);
            assert.equal(response.type, 'form');
            assert.deepEqual(response.components, form.components);
            template.forms.twoFaLoginForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
        });
      });

      it('Create 2Fa Recovery form', function(done) {
        const form = {
          noSave: true,
          title: 'Two-Factor Recovery Form',
          type: 'form',
          name: 'twoFactorRecoveryForm',
          path: 'user/twofactorrecoveryform',
          display: 'form',
          components: [
            {
              label: 'Recovery Code',
              autofocus: true,
              tableView: true,
              validate: {
                required: true,
              },
              key: 'token',
              type: 'textfield',
              input: true,
            },
            {
              label: 'Submit',
              showValidations: false,
              block: true,
              disableOnInvalid: true,
              tableView: false,
              key: 'submit',
              type: 'button',
              input: true,
            },
          ],
          access: template.forms.userLogin.access,
          submissionAccess: template.forms.userLogin.submissionAccess,
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(form)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
            assert.equal(response.title, form.title);
            assert.equal(response.name, form.name);
            assert.equal(response.path, form.path);
            assert.equal(response.type, 'form');
            assert.deepEqual(response.components, form.components);
            template.forms.twoFaRecoveryForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create 2Fa login action', function(done) {
        const action = {
            title: '2FA Login (Premium)',
            name: 'twofalogin',
            form: template.forms.twoFaLoginForm._id,
            condition: {
              eq: '',
              value: '',
              custom: '',
            },
            settings: {
              token: 'token',
            },
            priority: 2,
            method: ['create'],
            handler: ['before'],
          };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.twoFaLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(action)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, action.title);
            assert.equal(response.name, action.name);
            assert.deepEqual(response.handler, action.handler);
            assert.deepEqual(response.method, action.method);
            assert.equal(response.priority, action.priority);
            assert.deepEqual(response.settings, action.settings);
            assert.equal(response.form, template.forms.twoFaLoginForm._id);

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create 2Fa Recovery action', function(done) {
        const action =  {
          title: '2FA Recovery Login (Premium)',
          name: 'twofarecoverylogin',
          form: template.forms.twoFaRecoveryForm._id,
          condition: {
            eq: '',
            value: '',
            custom: '',
          },
          settings: {
            token: 'token',
          },
          priority: 2,
          method: ['create'],
          handler: ['before'],
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.twoFaRecoveryForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(action)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, action.title);
            assert.equal(response.name, action.name);
            assert.deepEqual(response.handler, action.handler);
            assert.deepEqual(response.method, action.method);
            assert.equal(response.priority, action.priority);
            assert.deepEqual(response.settings, action.settings);
            assert.equal(response.form, template.forms.twoFaRecoveryForm._id);

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Update user resource', function(done) {
        request(app)
          .get(hook.alter('url', '/form/' + template.resources.user._id, template))
          .set('x-jwt-token', template.users.admin.token)
          .send()
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            assert.equal(res.body._id, template.resources.user._id);
            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            const components = _.cloneDeep(res.body.components);
            const newComponents = [
              {
                label: 'Two-Factor Authentication Code',
                hidden: true,
                tableView: true,
                protected: true,
                key: 'twoFactorAuthenticationCode',
                type: 'textfield',
                input: true,
              },
              {
                label: 'Two-Factor Authentication Recovery Codes',
                hidden: true,
                tableView: true,
                multiple: true,
                protected: true,
                key: 'twoFactorAuthenticationRecoveryCodes',
                type: 'textfield',
                input: true,
              },
              {
                title: 'Two-Factor Authentication',
                theme: 'info',
                collapsible: true,
                key: 'FaPanel',
                customConditional:
                  'var user = Formio.getUser();\nshow = user && user._id && submission._id && user._id === submission._id;',
                type: 'panel',
                label: 'Two-Factor Authentication',
                input: false,
                tableView: false,
                components: [
                  {
                    html: '<h2 style="margin-left:0px;">Get verification codes with an Authenticator App</h2><p style="margin-left:0px;">If you set up 2-Step Verification, you can use an Authenticator App to receive codes. You can still receive codes without an internet connection or mobile service.</p><p style="margin-left:0px;">For example, <strong>Google Authenticator, Microsoft Authenticator, Authy</strong>,<strong> etc.</strong></p>',
                    label: 'Content',
                    refreshOnChange: false,
                    key: 'content',
                    type: 'content',
                    input: false,
                    tableView: false,
                  },
                  {
                    label: 'QR Code',
                    persistent: 'client-only',
                    trigger: {
                      init: false,
                      server: false,
                    },
                    refreshOnEvent: 'trigger2Fa',
                    event: 'qrLoaded',
                    dataSrc: 'url',
                    fetch: {
                      url: '{{Formio.projectUrl}}/2fa/{{data.twoFaMethod}}',
                      method: 'post',
                      headers: [
                        {
                          key: 'two-fa-datasource',
                          value: 'true',
                        },
                      ],
                      forwardHeaders: false,
                      authenticate: true,
                      specifyPostBody: '',
                    },
                    allowCaching: false,
                    key: 'qrCode',
                    logic: [
                      {
                        name: 'Clear Data',
                        trigger: {
                          type: 'event',
                          event: 'delete2Fa',
                        },
                        actions: [
                          {
                            name: 'Clear Data',
                            type: 'value',
                            value: 'value = null;',
                          },
                        ],
                      },
                    ],
                    type: 'datasource',
                    input: true,
                    tableView: false,
                  },
                  {
                    label: 'QrCode',
                    tag: 'div',
                    className: 'text-center mb-4',
                    attrs: [
                      {
                        attr: '',
                        value: '',
                      },
                    ],
                    content: '<img src="{{data.qrCode || \'\'}}" alt="QRCode">',
                    refreshOnChange: true,
                    key: 'qrCodeImage',
                    customConditional: "show = typeof data.qrCode === 'string';",
                    type: 'htmlelement',
                    input: false,
                    tableView: false,
                  },
                  {
                    title: 'Recovery Info Panel',
                    theme: 'danger',
                    collapsible: false,
                    hideLabel: true,
                    key: 'recoveryInfoPanel',
                    customConditional: 'show = data.verification && data.verification.recoveryCodes;',
                    type: 'panel',
                    label: 'Recovery Info Panel',
                    input: false,
                    tableView: false,
                    components: [
                      {
                        label: 'Recovery Codes',
                        persistent: 'client-only',
                        key: 'recoveryCodes',
                        logic: [
                          {
                            name: 'Set Velue',
                            trigger: {
                              type: 'javascript',
                              javascript: 'result = data.verification && data.verification.recoveryCodes;',
                            },
                            actions: [
                              {
                                name: 'Set Values',
                                type: 'value',
                                value:
                                  "var codes = '';\nfor(var i = 0; i < data.verification.recoveryCodes.length; i++){\n  codes += '<h4 style=\"margin-left:0px;text-align:center; color:red;\"><strong>' + data.verification.recoveryCodes[i] + '</strong></h4>';\n}\n\nif (codes && codes !== value) {\n  value = codes;\n}",
                              },
                            ],
                          },
                        ],
                        type: 'hidden',
                        input: true,
                        tableView: false,
                      },
                      {
                        label: 'Recovery Info',
                        tag: 'div',
                        attrs: [
                          {
                            attr: '',
                            value: '',
                          },
                        ],
                        refreshOnChange: false,
                        key: 'recoveryInfo',
                        logic: [
                          {
                            name: 'Set Content',
                            trigger: {
                              type: 'javascript',
                              javascript: 'result = !!data.recoveryCodes;',
                            },
                            actions: [
                              {
                                name: 'Set Content',
                                type: 'property',
                                property: {
                                  label: 'Content',
                                  value: 'content',
                                  type: 'string',
                                  component: 'content',
                                },
                                content:
                                  '<h5 style=\"margin-left:0px;text-align:center;\"><span class=\"text-big\"><strong>Please write it down in a safe place.</strong></span>.</h5>\n<h5 style=\"margin-left:0px;text-align:center;\"><span class=\"text-big\"><strong>If you lose access to your two-factor authentication credentials, you can use these recovery codes to log in.</strong></span></h5>\n<h5 style=\"margin-left:0px;text-align:center;\"><span class=\"text-big\"><strong>Each code is acceptable to one time login. After login it will be deleted.</strong></span></h5>\n{{data.recoveryCodes}}',
                              },
                            ],
                          },
                        ],
                        type: 'htmlelement',
                        input: false,
                        tableView: false,
                      },
                    ],
                  },
                  {
                    label: 'Two FA Method',
                    persistent: 'client-only',
                    key: 'twoFaMethod',
                    logic: [
                      {
                        name: 'Generate',
                        trigger: {
                          type: 'event',
                          event: 'generate2Fa',
                        },
                        actions: [
                          {
                            name: 'Set Value',
                            type: 'value',
                            value: "value = 'generate';",
                          },
                        ],
                      },
                      {
                        name: 'Represent',
                        trigger: {
                          type: 'event',
                          event: 'represent2Fa',
                        },
                        actions: [
                          {
                            name: 'Set Value',
                            type: 'value',
                            value: "value = 'represent';",
                          },
                        ],
                      },
                      {
                        name: 'Turn Off',
                        trigger: {
                          type: 'event',
                          event: 'turnOff2Fa',
                        },
                        actions: [
                          {
                            name: 'Set Value',
                            type: 'value',
                            value: "value = 'turn-off';",
                          },
                        ],
                      },
                    ],
                    type: 'hidden',
                    input: true,
                    tableView: false,
                  },
                  {
                    label: 'Columns',
                    columns: [
                      {
                        components: [],
                        width: 4,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        size: 'md',
                        currentWidth: 4
                      },
                      {
                        components: [
                          {
                            label: 'Turn On 2FA',
                            action: 'custom',
                            showValidations: false,
                            block: true,
                            tooltip: 'Turnes on the 2FA',
                            tableView: false,
                            key: 'turnOn2Fa',
                            conditional: {
                              show: false,
                              when: 'twoFactorAuthenticationEnabled',
                              eq: 'true',
                            },
                            type: 'button',
                            custom: "instance.emit('generate2Fa');\ninstance.emit('trigger2Fa');",
                            input: true,
                            hideOnChildrenHidden: false,
                          },
                        ],
                        width: 4,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        size: 'md',
                        currentWidth: 4
                      },
                      {
                        components: [],
                        size: 'md',
                        width: 4,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        currentWidth: 4
                      },
                    ],
                    key: 'columns1',
                    customConditional:
                      'show = !data.twoFactorAuthenticationEnabled && (!data.qrCode || data.qrCode.success);',
                    type: 'columns',
                    input: false,
                    tableView: false,
                  },
                  {
                    label: 'Columns',
                    columns: [
                      {
                        components: [
                          {
                            label: 'Show QR',
                            action: 'custom',
                            showValidations: false,
                            theme: 'success',
                            block: true,
                            tooltip: 'Represents an existing QR Code.',
                            tableView: false,
                            key: 'represent2Fa',
                            customConditional: 'show = !data.qrCode; ',
                            type: 'button',
                            custom: "instance.emit('represent2Fa');\ninstance.emit('trigger2Fa');",
                            input: true,
                            hideOnChildrenHidden: true,
                          },
                        ],
                        width: 4,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        size: 'md',
                        currentWidth: 4
                      },
                      {
                        components: [
                          {
                            label: 'Turn Off 2FA',
                            action: 'custom',
                            showValidations: false,
                            theme: 'danger',
                            block: true,
                            tooltip: 'Turnes off the 2FA.',
                            tableView: false,
                            key: 'turnOff2Fa',
                            customConditional:
                              'show = data.twoFactorAuthenticationEnabled && !(data.verification && data.verification.recoveryCode);',
                            type: 'button',
                            custom:
                              "instance.hook('onTurnOffTwoFa', function(isConfirmed){\n  if (isConfirmed) {\n    instance.emit('turnOff2Fa');\n    instance.emit('trigger2Fa');\n  }\n});",
                            input: true,
                            hideOnChildrenHidden: true,
                          },
                        ],
                        width: 4,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        size: 'md',
                        currentWidth: 4
                      },
                      {
                        components: [],
                        size: 'md',
                        width: 4,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        currentWidth: 4
                      },
                    ],
                    hideOnChildrenHidden: true,
                    key: 'columns',
                    conditional: {
                      show: true,
                      when: 'twoFactorAuthenticationEnabled',
                      eq: 'true',
                    },
                    type: 'columns',
                    input: false,
                    tableView: false,
                  },
                  {
                    label: 'Columns',
                    columns: [
                      {
                        components: [],
                        size: 'md',
                        width: 3,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        currentWidth: 3
                      },
                      {
                        components: [
                          {
                            label: 'Code',
                            placeholder: 'Code',
                            description: 'Verification code from the App',
                            inputMask: '999999',
                            hideLabel: true,
                            autofocus: true,
                            tableView: true,
                            persistent: 'client-only',
                            key: 'code',
                            logic: [
                              {
                                name: 'Reset Value',
                                trigger: {
                                  type: 'event',
                                  event: 'verify2Fa',
                                },
                                actions: [
                                  {
                                    name: 'Reset Value',
                                    type: 'value',
                                    value: "value = '';",
                                  },
                                ],
                              },
                              {
                                name: 'Validate',
                                trigger: {
                                  type: 'event',
                                  event: 'verified',
                                },
                                actions: [
                                  {
                                    name: 'Validate',
                                    type: 'customAction',
                                    customAction:
                                      'if(data.verification && data.verification.message) {\n  instance.setCustomValidity(data.verification.message, true, true)\n}',
                                  },
                                ],
                              },
                            ],
                            type: 'textfield',
                            input: true,
                            hideOnChildrenHidden: true,
                          },
                        ],
                        width: 4,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        size: 'md',
                        currentWidth: 4
                      },
                      {
                        components: [
                          {
                            label: 'Confirm',
                            action: 'event',
                            showValidations: false,
                            theme: 'success',
                            block: true,
                            disabled: true,
                            tableView: false,
                            key: 'comfirm2Fa',
                            logic: [
                              {
                                name: 'Set Enabled',
                                trigger: {
                                  type: 'javascript',
                                  javascript:
                                    "var code = data.code;\nresult = code && code.replace(/_/g, '').length === 6;",
                                },
                                actions: [
                                  {
                                    name: 'Set Enabled',
                                    type: 'property',
                                    property: {
                                      label: 'Disabled',
                                      value: 'disabled',
                                      type: 'boolean',
                                    },
                                    state: false,
                                  },
                                ],
                              },
                              {
                                name: 'Set Disabled',
                                trigger: {
                                  type: 'javascript',
                                  javascript:
                                    "var code = data.code;\nresult = !code || code.replace(/_/g, '').length !== 6;",
                                },
                                actions: [
                                  {
                                    name: 'Set Disabled',
                                    type: 'property',
                                    property: {
                                      label: 'Disabled',
                                      value: 'disabled',
                                      type: 'boolean',
                                    },
                                    state: true,
                                  },
                                ],
                              },
                            ],
                            type: 'button',
                            event: 'verify2Fa',
                            input: true,
                            hideOnChildrenHidden: true,
                          },
                        ],
                        offset: 0,
                        push: 0,
                        pull: 0,
                        size: 'md',
                        width: 2,
                        currentWidth: 2
                      },
                      {
                        components: [],
                        size: 'md',
                        width: 3,
                        offset: 0,
                        push: 0,
                        pull: 0,
                        currentWidth: 3
                      },
                    ],
                    hideOnChildrenHidden: true,
                    key: 'columns2',
                    customConditional:
                      "show = !!data.qrCode\n  && !['represent', 'turn-off'].includes(data.twoFaMethod) \n  && !(data.verification && data.verification.success);",
                    type: 'columns',
                    input: false,
                    tableView: false,
                  },
                  {
                    label: 'Verification',
                    persistent: 'client-only',
                    trigger: {
                      init: false,
                      server: false,
                    },
                    refreshOnEvent: 'verify2Fa',
                    event: 'verified',
                    dataSrc: 'url',
                    fetch: {
                      url: '{{Formio.projectUrl}}/2fa/turn-on',
                      method: 'post',
                      headers: [
                        {
                          key: 'two-fa-datasource',
                          value: 'true',
                        },
                      ],
                      forwardHeaders: true,
                      authenticate: true,
                      specifyPostBody: 'body = {\n  twoFaCode: data.code,\n}',
                    },
                    allowCaching: true,
                    key: 'verification',
                    logic: [
                      {
                        name: 'Clear Value',
                        trigger: {
                          type: 'event',
                          event: 'turnOff2Fa',
                        },
                        actions: [
                          {
                            name: 'Clear Value',
                            type: 'value',
                            value: "value = '';",
                          },
                        ],
                      },
                    ],
                    type: 'datasource',
                    input: true,
                    tableView: false,
                  },
                  {
                    label: 'Two-Factor Authentication Enabled',
                    hidden: true,
                    tableView: false,
                    defaultValue: false,
                    redrawOn: 'data',
                    clearOnHide: false,
                    calculateValue:
                      'value = (data.qrCode && data.qrCode.success) ? false : value || (data.verification && data.verification.success);',
                    key: 'twoFactorAuthenticationEnabled',
                    type: 'checkbox',
                    input: true,
                  },
                ],
                collapsed: true,
              },
            ];

            const insertIndex = _.findIndex(components, {key: 'submit'});

            if (!insertIndex || insertIndex === -1) {
              return done('No submit button');
            }

            components.splice(insertIndex, 0, ...newComponents);

            request(app)
            .put(hook.alter('url', '/form/' + template.resources.user._id, template))
            .set('x-jwt-token', template.users.admin.token)
            .send({
              ...res.body,
              components
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, resp) {
              if (err) {
                return done(err);
              }

              assert.equal(resp.body._id, template.resources.user._id);
              assert.equal(resp.body.components.length, components.length);

              // Store the JWT for future API calls.
              template.users.admin.token = resp.headers['x-jwt-token'];

              done();
            });
          });
      });

      it('Register a new user', function(done) {
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.userRegister._id + '/submission', template))
        .send({
          data: {
            'email': USER_EMAIL,
            'password': USER_PASSWORD
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
          assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
          assert.equal(response.data.email, USER_EMAIL);
          assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
          assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
          assert.equal(response.form, template.resources.user._id);
          assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
          assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
          assert.notEqual(response.owner, null);
          assert.equal(response.owner, response._id);
          assert.equal(response.roles.length, 1);
          assert.equal(response.roles[0].toString(), template.roles.authenticated._id.toString());

          // Update our user data.
          template.users.user2fa = response;
          template.users.user2fa.data.password = USER_PASSWORD;

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Switch on 2FA settings for user', function(done) {
        request(app)
        .post(hook.alter('url', '/2fa/generate', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(200)
        .expect('Content-Type', /text\/html/)
        .end(async function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert(response.length, 'The response should contain a secret key.');
          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];
          template.users.user2fa.secretKey = response;

          const twoFaCode = get2FaCode(response);

          request(app)
          .post(hook.alter('url', '/2fa/turn-on', template))
          .set('x-jwt-token', template.users.user2fa.token)
          .send({twoFaCode})
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, resp) {
            if (err) {
              return done(err);
            }

            assert(resp.body.success, 'The response should contain a success true.');
            assert(!!resp.body.recoveryCodes && !!resp.body.recoveryCodes.length, 'The response should contain recoveryCodes.');

            template.users.user2fa.recoveryCodes = resp.body.recoveryCodes;

            done()
          });
        });
      });
    });

    describe('2FA tests', function() {
      it('Log in a new user with 2FA', function(done) {
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.userLogin._id + '/submission', template))
        .send({
          data: {
            'email': template.users.user2fa.data.email,
            'password': template.users.user2fa.data.password
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response should contain an isTwoFactorAuthenticationRequired`.');
          assert.equal(response.isTwoFactorAuthenticationRequired, true);

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t get an access to the current endpoint', function(done) {
        request(app)
        .get(hook.alter('url', '/current', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response should contain an isTwoFactorAuthenticationRequired`.');
          assert.equal(response.isTwoFactorAuthenticationRequired, true);

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t get an access to user profile', function(done) {
        request(app)
        .get(hook.alter('url', '/form/' + template.resources.user._id + '/submission/' + template.users.user2fa._id, template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Should Authenticate 2FA', function(done) {
        const twoFaCode = get2FaCode(template.users.user2fa.secretKey);
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.twoFaLoginForm._id + '/submission', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send({
          data: {
            token: twoFaCode,
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(!response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response shouldn\`t contain an isTwoFactorAuthenticationRequired`.');

          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
          assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
          assert.equal(response.data.email, template.users.user2fa.data.email);
          assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationCode'), 'The submission `data` should not contain the `twoFactorAuthenticationCode`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationRecoveryCodes'), 'The submission `data` should not contain the `twoFactorAuthenticationRecoveryCodes`.');
          assert(response.data.hasOwnProperty('twoFactorAuthenticationEnabled'), 'The submission `data` should not contain the `twoFactorAuthenticationEnabled`.');
          assert.equal(response.data.twoFactorAuthenticationEnabled, true);
          assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
          assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Should get an access to user profile', function(done) {
        request(app)
        .get(hook.alter('url', '/form/' + template.resources.user._id + '/submission/' + template.users.user2fa._id, template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(!response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response shouldn\`t contain an isTwoFactorAuthenticationRequired`.');

          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
          assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
          assert.equal(response.data.email, template.users.user2fa.data.email);
          assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationCode'), 'The submission `data` should not contain the `twoFactorAuthenticationCode`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationRecoveryCodes'), 'The submission `data` should not contain the `twoFactorAuthenticationRecoveryCodes`.');
          assert(response.data.hasOwnProperty('twoFactorAuthenticationEnabled'), 'The submission `data` should not contain the `twoFactorAuthenticationEnabled`.');
          assert.equal(response.data.twoFactorAuthenticationEnabled, true);
          assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
          assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Log in the user with 2FA', function(done) {
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.userLogin._id + '/submission', template))
        .send({
          data: {
            'email': template.users.user2fa.data.email,
            'password': template.users.user2fa.data.password
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response should contain an isTwoFactorAuthenticationRequired`.');
          assert.equal(response.isTwoFactorAuthenticationRequired, true);

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t Authenticate 2FA with the incorrect code length', function(done) {
        const twoFaCode = '1234567';
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.twoFaLoginForm._id + '/submission', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send({
          data: {
            token: twoFaCode,
          }
        })
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('details'), 'The response should contain an `details`.');
          assert.equal(response.details.length, 2);
          assert.equal(response.details[0].message, 'Code must have no more than 6 characters.');
          assert.equal(response.details[1].message, 'Code does not match the mask.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t Authenticate 2FA with the incorrect code', function(done) {
        const twoFaCode = '123456';
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.twoFaLoginForm._id + '/submission', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send({
          data: {
            token: twoFaCode,
          }
        })
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert.equal(response, 'Bad 2FA token.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Should Authenticate 2FA with a recovery code', function(done) {
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.twoFaRecoveryForm._id + '/submission', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send({
          data: {
            token: template.users.user2fa.recoveryCodes[0],
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;

          assert(!response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response shouldn\`t contain an isTwoFactorAuthenticationRequired`.');
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
          assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
          assert.equal(response.data.email, template.users.user2fa.data.email);
          assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationCode'), 'The submission `data` should not contain the `twoFactorAuthenticationCode`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationRecoveryCodes'), 'The submission `data` should not contain the `twoFactorAuthenticationRecoveryCodes`.');
          assert(response.data.hasOwnProperty('twoFactorAuthenticationEnabled'), 'The submission `data` should not contain the `twoFactorAuthenticationEnabled`.');
          assert.equal(response.data.twoFactorAuthenticationEnabled, true);
          assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
          assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Log in the user with 2FA', function(done) {
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.userLogin._id + '/submission', template))
        .send({
          data: {
            'email': template.users.user2fa.data.email,
            'password': template.users.user2fa.data.password
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response should contain an isTwoFactorAuthenticationRequired`.');
          assert.equal(response.isTwoFactorAuthenticationRequired, true);

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t Authenticate 2FA with the used recovery code', function(done) {
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.twoFaRecoveryForm._id + '/submission', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send({
          data: {
            token: template.users.user2fa.recoveryCodes[0],
          }
        })
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert.equal(response, 'Recovery code was incorrect.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t generate new code if 2FA is not Authenticated', function(done) {
        request(app)
        .post(hook.alter('url', '/2fa/generate', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert.equal(response, '2FA Unauthorized.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t represent qr code if 2FA is not Authenticated', function(done) {
        request(app)
        .post(hook.alter('url', '/2fa/represent', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert.equal(response, '2FA Unauthorized.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Shouldn\'t turn off 2FA if 2FA is not Authenticated', function(done) {
        request(app)
        .post(hook.alter('url', '/2fa/turn-off', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert.equal(response, '2FA Unauthorized.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Should Authenticate 2FA', function(done) {
        const twoFaCode = get2FaCode(template.users.user2fa.secretKey);
        request(app)
        .post(hook.alter('url', '/form/' + template.forms.twoFaLoginForm._id + '/submission', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send({
          data: {
            token: twoFaCode,
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(!response.hasOwnProperty('isTwoFactorAuthenticationRequired'), 'The response shouldn\`t contain an isTwoFactorAuthenticationRequired`.');

          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
          assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
          assert.equal(response.data.email, template.users.user2fa.data.email);
          assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationCode'), 'The submission `data` should not contain the `twoFactorAuthenticationCode`.');
          assert(!response.data.hasOwnProperty('twoFactorAuthenticationRecoveryCodes'), 'The submission `data` should not contain the `twoFactorAuthenticationRecoveryCodes`.');
          assert(response.data.hasOwnProperty('twoFactorAuthenticationEnabled'), 'The submission `data` should not contain the `twoFactorAuthenticationEnabled`.');
          assert.equal(response.data.twoFactorAuthenticationEnabled, true);
          assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
          assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Should represent qr code', function(done) {
        request(app)
        .post(hook.alter('url', '/2fa/represent', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(200)
        .expect('Content-Type', /text/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert.equal(response.indexOf('data:image/png;base64'), 0);

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Sholdn\`t generate new qr code', function(done) {
        request(app)
        .post(hook.alter('url', '/2fa/generate', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(400)
        .expect('Content-Type', /text/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;

          assert.equal(response, '2FA has already been turned on.');

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Should turn off 2FA', function(done) {
        request(app)
        .post(hook.alter('url', '/2fa/turn-off', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;

          assert.equal(response.success, true);

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });

      it('Check the user data', function(done) {
        request(app)
        .get(hook.alter('url', '/current', template))
        .set('x-jwt-token', template.users.user2fa.token)
        .send()
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.data.hasOwnProperty('twoFactorAuthenticationEnabled'), 'The response should contain an twoFactorAuthenticationEnabled`.');
          assert.equal(response.data.twoFactorAuthenticationEnabled, false);

          // Store the JWT for future API calls.
          template.users.user2fa.token = res.headers['x-jwt-token'];

          done();
        });
      });
    });
  });
};
