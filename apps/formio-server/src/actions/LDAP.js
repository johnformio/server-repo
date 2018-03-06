'use strict';

const util = require('formio/src/util/util');
const _ = require('lodash');
const crypto = require('crypto');
const Q = require('q');

module.exports = router => {
  const formio = router.formio;
  const {
    Action,
    hook
  } = router.formio;

  /**
   * LDAPAction class.
   *   This class is used to create the LDAP action.
   */
  class LDAPAction extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'ldap',
        title: 'LDAP Login',
        description: 'Provides ldap login.',
        priority: 1, // Needs to be before LoginAction (2) so we can fall back on form.io login.
        defaults: {
          handler: ['before'],
          method: ['create']
        }
      }));
    }

    /**
     * Settings form for auth action.
     *
     * @param req
     * @param res
     * @param next
     */
    static settingsForm(req, res, next) {
      formio.cache.loadCurrentForm(req, (err, form) => {
        if (err || !form) {
          return res.status(400).send('Could not load form.');
        }
        const usernameOptions = [];
        const passwordOptions = [];
        util.eachComponent(form.components, (component, path) => {
          if (['textfield', 'email'].includes(component.type)) {
            usernameOptions.push({label: component.title || component.label || component.key, value: path});
          }
          if (component.type === 'password') {
            passwordOptions.push({label: component.title || component.label || component.key, value: path});
          }
        });
        formio.resources.role.model.find(formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req))
          .sort({title: 1})
          .exec((err, roles) =>  {
            if (err || !roles) {
              return res.status(400).send('Could not load the Roles.');
            }
            const settingForm = [
              {
                type: 'select',
                input: true,
                label: 'Username field',
                key: 'usernameField',
                placeholder: `Select which field is the username field`,
                template: '<span>{{ item.label }}</span>',
                dataSrc: 'values',
                data: {values: usernameOptions},
                valueProperty: 'value',
                validate: {
                  required: true
                },
                multiple: false,
              },
              {
                type: 'select',
                input: true,
                label: 'Password field',
                key: 'passwordField',
                placeholder: `Select which field is the password field`,
                template: '<span>{{ item.label }}</span>',
                dataSrc: 'values',
                data: {values: passwordOptions},
                valueProperty: 'value',
                validate: {
                  required: true
                },
                multiple: false,
              },
              {
                input: true,
                tree: true,
                components: [
                  {
                    input: true,
                    inputType: "text",
                    label: "LDAP Property",
                    key: "property",
                    multiple: false,
                    placeholder: "Leave empty for everyone",
                    defaultValue: "",
                    protected: false,
                    unique: false,
                    persistent: true,
                    hidden: false,
                    clearOnHide: true,
                    type: "textfield"
                  },
                  {
                    input: true,
                    inputType: "text",
                    label: "Value",
                    key: "value",
                    multiple: false,
                    defaultValue: "",
                    protected: false,
                    unique: false,
                    persistent: true,
                    hidden: false,
                    clearOnHide: true,
                    type: "textfield"
                  },
                  {
                    input: true,
                    tableView: true,
                    label: "Role",
                    key: "role",
                    placeholder: "",
                    dataSrc: 'json',
                    data: {json: roles},
                    valueProperty: '_id',
                    defaultValue: "",
                    refreshOn: "",
                    filter: "",
                    template: "<span>{{ item.title }}</span>",
                    multiple: false,
                    protected: false,
                    unique: false,
                    persistent: true,
                    hidden: false,
                    clearOnHide: true,
                    validate: {
                      required: true
                    },
                    type: "select"
                  }
                ],
                tableView: true,
                label: "Assign Roles",
                key: "roles",
                protected: false,
                persistent: true,
                hidden: false,
                clearOnHide: true,
                type: "datagrid"
              }
            ];
            next(null, settingForm);
          });
      });
    }

    /**
     * Authenticate with Form.io using LDAP
     *
     * Note: Requires req.body to contain an LDAP authorization code.
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

    /* eslint-disable max-depth */
    resolve(handler, method, req, res, next) {
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      if (this.settings.association === 'new' && (!this.settings.hasOwnProperty('role') || !this.settings.role)) {
        return res.status(400).send('The LDAP Action requires a Role to be selected for new resources.');
      }

      if (this.settings.association === 'existing' && this.settings.hasOwnProperty('role') && this.settings.role) {
        this.settings = _.omit(this.settings, 'role');
      }

      if (!this.settings.provider) {
        return res.status(400).send('LDAP Action is missing Provider setting.');
      }

      // Non-link association requires a resource setting
      if (['existing', 'new'].indexOf(this.settings.association) !== -1 && !this.settings.resource) {
        return res.status(400).send('LDAP Action is missing Resource setting.');
      }

      if (!this.settings.button) {
        return res.status(400).send('LDAP Action is missing Button setting.');
      }

      var self = this;
      var provider = formio.oauth.providers[this.settings.provider];

      // Modify the button to be an LDAP button
      if (
        handler === 'after' &&
        method === 'form' &&
        req.query.hasOwnProperty('live') && (parseInt(req.query.live, 10) === 1) &&
        res.hasOwnProperty('resource') &&
        res.resource.hasOwnProperty('item') &&
        res.resource.item._id
      ) {
        return Q.ninvoke(formio.hook, 'settings', req)
          .then(function(settings) {
            var component = util.getComponent(res.resource.item.components, self.settings.button);
            if (!component) {
              return next();
            }
            var state = crypto.randomBytes(64).toString('hex');
            if (provider.configureLDAPButton) { // Use custom provider configuration
              provider.configureLDAPButton(component, settings, state);
            }
            else { // Use default configuration, good for most oauth providers
              var oauthSettings = _.get(settings, `oauth.${  provider.name}`);
              if (oauthSettings) {
                if (!oauthSettings.clientId || !oauthSettings.clientSecret) {
                  component.oauth = {
                    provider: provider.name,
                    error: `${provider.title  } LDAP provider is missing client ID or client secret`
                  };
                }
                else {
                  component.oauth = {
                    provider: provider.name,
                    clientId: oauthSettings.clientId,
                    authURI: oauthSettings.authURI || provider.authURI,
                    state: state,
                    scope: oauthSettings.scope || provider.scope
                  };
                  if (provider.display) {
                    component.oauth.display = provider.display;
                  }
                }
              }
            }
            next();
          })
          .catch(next);
      }
      else if (
        handler === 'after' &&
        method === 'create' &&
        req.oauthDeferredAuth &&
        req.oauthDeferredAuth.provider === provider.name
      ) {
        return self.reauthenticateNewResource(req, res, provider)
          .then(function() {
            next();
          })
          .catch(this.onError(req, res, next));
      }
      else {
        return next();
      }
    }

    /* eslint-enable max-depth */
  }

  // Disable editing handler and method settings
  LDAPAction.access = {
    handler: false,
    method: false
  };

  // Return the LDAPAction.
  return LDAPAction;
};
