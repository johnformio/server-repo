'use strict';
const _ = require('lodash');

/**
 * Update 3.3.11
 *
 * Implements Two-Factor Authentication.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
 module.exports = async function(db, config, tools, done) {
  // Perform in background.
  done();
  const projects = db.collection('projects');
  const forms = db.collection('forms');
  const actions = db.collection('actions');
  const roles = db.collection('roles');

  const setRoles = (roles) => {
    return roles.reduce((acc, role) => {
      if (role){
        acc.push(role._id);
      }
      return acc;
    }, []);
  };

  let twoFaLoginForm = null;
  let twoFaResetForm = null;

  const project = await projects.findOne({
    primary: true
  });


  if (!project) {
    console.log('No primary project found for implementing 2FA.');
    return;
  }

  // Get the anonymous role.
  const anonymousRole = await roles.findOne({
    project: project._id,
    default: true
  });

  // Get the authenticated role.
  const authenticatedRole = await roles.findOne({
    project: project._id,
    title: "Authenticated"
  });

  // Get the administrator role.
  const administratorRole = await roles.findOne({
    project: project._id,
    title: "Administrator"
  });

  const updateUserResource = async function () {
    try {
      const userResource = await forms.findOne(
        {
          project: project._id,
          name: 'user',
        });

      if (!userResource) {
        return;
      }

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
          label: 'Two-Factor Authentication Enabled',
          hidden: true,
          tableView: false,
          defaultValue: false,
          redrawOn: 'data',
          clearOnHide: false,
          key: 'twoFactorAuthenticationEnabled',
          type: 'checkbox',
          input: true,
        },
      ];
      const components = _.cloneDeep(userResource.components)

      if (components.some(({key}) => ['twoFactorAuthenticationCode', 'twoFactorAuthenticationRecoveryCodes', 'twoFactorAuthenticationEnabled'].includes(key))) {
        return;
      }

      const insertIndex = _.findIndex(components, {key: 'submit'});

      if (!insertIndex || insertIndex === -1) {
        console.log('No submit button');
        return;
      }

      // Adds new components to the User resource.
      components.splice(insertIndex, 0, ...newComponents)

      console.log('Updating user resource.');
      await forms.updateOne(
        {
          _id: userResource._id,
        },
        {
          $set: {
            components: components,
          },
        });
      console.log('Updated user resource.');
    } catch (error) {

    }
  };

  const add2FaLoginForm = async function () {
    try {
      const twoFaForm = await forms.findOne({
        project: project._id,
        name: 'twoFaLoginForm',
        deleted: { $eq: null },
      });

      if (twoFaForm) {
        twoFaLoginForm = twoFaForm;
        return;
      }

      // If no verify account form then create it.
      const form = {
        title: 'Two-Factor Authentication Form',
        type: 'form',
        name: 'twoFaLoginForm',
        path: 'user/twofaloginform',
        display: 'form',
        tags: [],
        settings: {},
        deleted: null,
        project: project._id,
        owner: project.owner,
        created: new Date(),
        modified: new Date(),
        machineName: `${project.machineName}:twoFaLoginForm`,
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
        access: [
          {
            roles: [],
            type: 'create_own',
          },
          {
            roles: [],
            type: 'create_all',
          },
          {
            roles: [],
            type: 'read_own',
          },
          {
            roles: setRoles([administratorRole, authenticatedRole, anonymousRole]),
            type: 'read_all',
          },
          {
            roles: [],
            type: 'update_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'update_all',
          },
          {
            roles: [],
            type: 'delete_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'delete_all',
          },
          {
            roles: [],
            type: 'team_read',
          },
          {
            roles: [],
            type: 'team_write',
          },
          {
            roles: [],
            type: 'team_admin',
          },
        ],
        submissionAccess: [
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'create_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'create_all',
          },
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'read_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'read_all',
          },
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'update_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'update_all',
          },
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'delete_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'delete_all',
          },
          {
            roles: [],
            type: 'team_read',
          },
          {
            roles: [],
            type: 'team_write',
          },
          {
            roles: [],
            type: 'team_admin',
          },
        ],
      };

      console.log('Creating 2FA Login form.');
      const { insertedId } = await forms.insertOne(form);
      twoFaLoginForm = await forms.findOne({ _id: insertedId });
      console.log('Created 2FA Login form.');
      return;
    } catch (err) {
      console.log(err.message);
      return;
    }
  };

  const add2FaRecoveryForm = async function () {
    try {
      const twoFaForm = await forms.findOne({
        project: project._id,
        name: 'twoFactorRecoveryForm',
        deleted: { $eq: null },
      });

      if (twoFaForm) {
        twoFaResetForm = twoFaForm;
        return;
      }

      // If no verify account form then create it.
      const form = {
        title: 'Two-Factor Recovery Form',
        type: 'form',
        name: 'twoFactorRecoveryForm',
        path: 'user/twofactorrecoveryform',
        display: 'form',
        tags: [],
        settings: {},
        deleted: null,
        project: project._id,
        owner: project.owner,
        created: new Date(),
        modified: new Date(),
        machineName: `${project.machineName}:twoFactorRecoveryForm`,
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
        access: [
          {
            roles: [],
            type: 'create_own',
          },
          {
            roles: [],
            type: 'create_all',
          },
          {
            roles: [],
            type: 'read_own',
          },
          {
            roles: setRoles([administratorRole, authenticatedRole, anonymousRole]),
            type: 'read_all',
          },
          {
            roles: [],
            type: 'update_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'update_all',
          },
          {
            roles: [],
            type: 'delete_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'delete_all',
          },
          {
            roles: [],
            type: 'team_read',
          },
          {
            roles: [],
            type: 'team_write',
          },
          {
            roles: [],
            type: 'team_admin',
          },
        ],
        submissionAccess: [
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'create_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'create_all',
          },
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'read_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'read_all',
          },
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'update_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'update_all',
          },
          {
            roles: setRoles([authenticatedRole, anonymousRole]),
            type: 'delete_own',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'delete_all',
          },
          {
            roles: [],
            type: 'team_read',
          },
          {
            roles: [],
            type: 'team_write',
          },
          {
            roles: [],
            type: 'team_admin',
          },
        ],
      };

      console.log('Creating 2FA Recovery form.');
      const { insertedId } = await forms.insertOne(form);
      twoFaResetForm = await forms.findOne({ _id: insertedId });
      console.log('Created 2FA Recovery form.');
      return;
    } catch (err) {
      console.log(err.message);
      return;
    }
  };

  const add2FaLoginAction = async function () {
    if (!twoFaLoginForm) {
      return;
    }

    try {
      const loginAction = await actions.findOne({
        form: twoFaLoginForm._id,
        name: 'twofalogin',
        deleted: { $eq: null },
      });

      if (loginAction) {
        return;
      }

      const action = {
        title: '2FA Login (Premium)',
        name: 'twofalogin',
        form: twoFaLoginForm._id,
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
        machineName: `${twoFaLoginForm.machineName}:twofalogin`,
      };

      console.log('Creating 2FA login action.');
      await actions.insertOne(action);
      console.log('Created 2FA login action.');
      return;
    } catch (err) {
      console.log(err.message);
      return;
    }
  };

  const add2FaRecoveryAction = async function () {
    if (!twoFaResetForm) {
      return;
    }

    try {
      const loginAction = await actions.findOne({
        form: twoFaResetForm._id,
        name: 'twofarecoverylogin',
        deleted: { $eq: null },
      });

      if (loginAction) {
        return;
      }

      const action = {
        title: '2FA Recovery Login (Premium)',
        name: 'twofarecoverylogin',
        form: twoFaResetForm._id,
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
        machineName: `${twoFaResetForm.machineName}:twofarecoverylogin`,
      };

      console.log('Creating 2FA recovery action.');
      await actions.insertOne(action);
      console.log('Created 2FA recovery action.');
      return;
    } catch (err) {
      console.log(err.message);
      return;
    }
  };

  const add2FaSettingsForm = async function () {
    try {
      const twoFaForm = await forms.findOne({
        project: project._id,
        name: 'twoFactorAuthenticationSettingsForm',
        deleted: { $eq: null },
      });

      if (twoFaForm) {
        return;
      }

      // If no verify account form then create it.
      const form = {
        title: 'Two-Factor Authentication Settings Form',
        type: 'form',
        name: 'twoFactorAuthenticationSettingsForm',
        path: 'user/twofasettingsform',
        deleted: null,
        project: project._id,
        owner: project.owner,
        created: new Date(),
        modified: new Date(),
        machineName: `${project.machineName}:twoFactorAuthenticationSettingsForm`,
        tags: [],
        components: [
          {
            label: 'Spinner',
            tag: 'div',
            attrs: [
              {
                attr: '',
                value: '',
              },
            ],
            content:
              '<div class="text-center">\r\n  <div class="spinner-border text-primary" role="status">\r\n    <span class="sr-only">Loading...</span>\r\n  </div>\r\n</div>',
            refreshOnChange: true,
            key: 'spinner',
            customConditional: 'show = !data.userLoaded;',
            type: 'htmlelement',
            input: false,
            tableView: false,
          },
          {
            title: 'Two-Factor Authentication',
            theme: 'info',
            collapsible: false,
            hideLabel: true,
            key: 'FaPanel',
            customConditional: 'show = data.userLoaded;\n',
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
                  forwardHeaders: true,
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
                              '<h5 style="margin-left:0px;text-align:center;"><span class="text-big"><strong>Please write it down in a safe place.</strong></span>.</h5>\n<h5 style="margin-left:0px;text-align:center;"><span class="text-big"><strong>If you lose access to your two-factor authentication credentials, you can use these recovery codes to log in.</strong></span></h5>\n<h5 style="margin-left:0px;text-align:center;"><span class="text-big"><strong>Each code is acceptable to one time login. After login it will be deleted.</strong></span></h5>\n{{data.recoveryCodes}}',
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
                    currentWidth: 4,
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
                    currentWidth: 4,
                  },
                  {
                    components: [],
                    size: 'md',
                    width: 4,
                    offset: 0,
                    push: 0,
                    pull: 0,
                    currentWidth: 4,
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
                    currentWidth: 4,
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
                          "instance.hook('onTurnOffTwoFa', function(isConfirmed){\nif (isConfirmed) {\n    instance.emit('turnOff2Fa');\n    instance.emit('trigger2Fa');\n  }\n});\n",
                        input: true,
                        hideOnChildrenHidden: true,
                      },
                    ],
                    width: 4,
                    offset: 0,
                    push: 0,
                    pull: 0,
                    size: 'md',
                    currentWidth: 4,
                  },
                  {
                    components: [],
                    size: 'md',
                    width: 4,
                    offset: 0,
                    push: 0,
                    pull: 0,
                    currentWidth: 4,
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
                    currentWidth: 3,
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
                        encrypted: true,
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
                    currentWidth: 4,
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
                    currentWidth: 2,
                  },
                  {
                    components: [],
                    size: 'md',
                    width: 3,
                    offset: 0,
                    push: 0,
                    pull: 0,
                    currentWidth: 3,
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
                allowCaching: false,
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
            ],
          },
        ],
        display: 'form',
        access: [
          {
            roles: setRoles([administratorRole, authenticatedRole]),
            type: 'read_all',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'update_all',
          },
          {
            roles: setRoles([administratorRole]),
            type: 'delete_all',
          },
        ],
        submissionAccess: [],
        controller:
          "function updateUserData() {\n  Formio.makeStaticRequest(Formio.projectUrl + '/current', 'GET', null, { ignoreCache: true })\n    .then(function(user) {\n      if (user && user.data) {\n      Formio.setUser(user);\n      var newData = Object.assign(instance.data, user.data);\n      instance.data = newData;\n      instance.data.userLoaded = true;\n      instance.triggerChange();\n    }\n  });\n}\n\nif (instance && Formio) {\n  updateUserData();\n  instance.on('verified', updateUserData);\n  instance.on('qrLoaded', function() {\n    if (data.twoFaMethod === 'turn-off') {\n      updateUserData();\n    }\n  });\n}\n\nif (instance && instance.options) {\n  if (!instance.options.hooks) {\n    instance.options.hooks = {};\n  }\n  \n  if (!instance.options.hooks.onTurnOffTwoFa) {\n    instance.options.hooks.onTurnOffTwoFa = function(cb) {\n      var isConfirmed = confirm('Are you sure you want to turn off Two-Factor Authentication?');\n      \n      cb(isConfirmed);\n    }\n  }\n}",
        settings: {},
      };

      console.log('Creating 2FA Settings form.');
      await forms.insertOne(form);
      console.log('Created 2FA Settings form.');
      return;
    } catch (err) {
      console.log(err.message);
      return;
    }
  };

  await updateUserResource();
  await add2FaLoginForm();
  await add2FaLoginAction();
  await add2FaRecoveryForm();
  await add2FaRecoveryAction();
  await add2FaSettingsForm();
  console.log('Done!');
};
