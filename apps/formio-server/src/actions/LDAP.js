'use strict';

const util = require('formio/src/util/util');
const _ = require('lodash');
const LdapAuth = require('ldapauth-fork');
const debug = require('debug')('formio:ldap');

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
    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'ldap',
        title: 'LDAP Login',
        description: 'Provides ldap login.',
        priority: 3, // Needs to be after LoginAction (2) so we can fall back on form.io login.
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
    static async settingsForm(req, res, next) {
      try {
      const form = await formio.cache.loadCurrentForm(req);
        if (!form) {
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
        try {
          const roles = await formio.resources.role.model.find(formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req))
          .sort({title: 1})
          .lean()
          .exec();
            if (!roles) {
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
                inputType: "checkbox",
                label: "Passthrough",
                key: "passthrough",
                defaultValue: false,
                persistent: true,
                hidden: false,
                clearOnHide: true,
                type: "checkbox",
                labelPosition: "right",
                properties: { },
                /* eslint-disable max-len */
                tooltip: "If enabled, failed requests will pass through to the next action handler. This allows using multiple login actions. Incorrect passwords will still fail."
                /* eslint-enable max-len */
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
            return next(null, settingForm);
        }
        catch (err) {
          return res.status(400).send('Could not load the Roles.');
        }
    }
    catch (err) {
      return res.status(400).send('Could not load form.');
      }
    }

    processAuth(req, res, data, user, token) {
      return this.checkForLDAPTeams(req, data, user).then((user) => {
        req.user = user;
        req.token = token;
        res.token = formio.auth.getToken(token);
        req['x-jwt-token'] = res.token;
        debug('Token Created');

        // Set the headers if they haven't been sent yet.
        if (!res.headersSent) {
          const headers = formio.hook.alter('accessControlExposeHeaders', 'x-jwt-token');
          res.setHeader('Access-Control-Expose-Headers', headers);
          res.setHeader('x-jwt-token', res.token);
        }
        debug('Headers Set');

        debug('Sending response', user);

        return res.send(user);
      }).catch((err) => {
        debug('Error occurred 2: ', err);
        return res.status(401).send(err);
      });
    }

    checkForLDAPTeams(req, data, user) {
      return new Promise((resolve, reject) => {
      router.formio.teams.getTeams(user, false, true).then(()=>resolve(user));
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

    async resolve(handler, method, req, res, next) {
      debug('Starting LDAP Login');
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      if (!this.settings.usernameField) {
        debug('Username field setting missing');
        return res.status(400).send('LDAP Action is missing Username Field setting.');
      }

      if (!this.settings.passwordField) {
        debug('Password field setting missing');
        return res.status(400).send('LDAP Action is missing Password Field setting.');
      }

      const settings = await hook.settings(req);
        if (!settings.ldap || !settings.ldap.url) {
          debug('LDAP Project settings not configured');
          return res.status(400).send('LDAP Project settings not configured.');
        }

        const auth = new LdapAuth(settings.ldap);
        debug('LDAP Auth instantiated');

        debug('Authenticating');
        try {
          auth.authenticate(
            _.get(req.submission.data, this.settings.usernameField),
            _.get(req.submission.data, this.settings.passwordField),
            (err, data) => {
              // If they have the wrong ldap credentials, return that error.
              if (err) {
                err = err.hasOwnProperty('lde_message') ? err.lde_message : err.toString();
              }
              if (err && (['Invalid Credentials'].includes(err) || !this.settings.passthrough)) {
                debug('Error occurred 1: ', err);
                auth.close();
                return res.status(401).send(err);
              }

              // If something goes wrong, skip auth and pass through to other login handlers.
              if (err || !data) {
                debug('No data returned');
                auth.close();
                return next();
              }

              // No longer need the ldap connection.
              auth.close(() => {
                let skipfirst = true;
                // Map the dn to be properties on data so we can assign roles based on them.
                data.dn.split(',').forEach(part => {
                  // The first item is already in the data as it is the identifier.
                  if (skipfirst) {
                    skipfirst = false;
                    return;
                  }
                  const pieces = part.split('=');
                  if (data.hasOwnProperty(pieces[0])) {
                    // If it already exists but isn't an array, make it an array.
                    if (!Array.isArray(data[pieces[0]])) {
                      data[pieces[0]] = [data[pieces[0]]];
                    }
                    data[pieces[0]].push(pieces[1]);
                  }
                  else {
                    data[pieces[0]] = pieces[1];
                  }
                });
                debug('User data', data);

                // Assign roles based on settings.
                const roles = [];
                _.map(this.settings.roles, map => {
                  if (!map.property ||
                    _.get(data, map.property) === map.value ||
                    _.includes(_.get(data, map.property), map.value)
                  ) {
                    roles.push(map.role);
                  }
                });
                debug('Assigned Roles', roles);

                const whiteList = [
                  'dn',
                  'cn',
                  'givenName',
                  'initials',
                  'name',
                  'fullName',
                  'sn',
                  'displayName',
                  'description',
                  'physicalDeliveryOfficeName',
                  'telephoneNumber',
                  'otherTelephone',
                  'mail',
                  'wWWHomePage',
                  'url',
                  'streetAddress',
                  'postOfficeBox',
                  'l',
                  'st',
                  'postalCode',
                  'c', 'co', 'countryCode',
                  'userPrincipalName',
                  'sAMAccountName',
                  'logonHours',
                  'userWorkstations',
                  'pwdLastSet',
                  'accountExpires',
                  'homePhone',
                  'otherHomePhone',
                  'pager',
                  'otherPager',
                  'mobile',
                  'otherMobile',
                  'facsimileTelephoneNumber',
                  'otherFacsimileTelephoneNumber',
                  'ipPhone',
                  'otherIpPhone',
                  'info',
                  'title',
                  'department',
                  'company',
                  'manager',
                  'uid',
                  'uidNumber'
                ];

                debug('Deleting non-whitelisted fields');
                // Remove all keys which aren't whitelisted.
                Object.keys(data).forEach(key => {
                  if (!whiteList.includes(key)) {
                    delete data[key];
                  }
                });

                if (data.mail && !data.email) {
                  data.email = data.mail;
                }

                const user = {
                  _id: data.uidNumber || data.uid || data.dn, // Try to use numbers but fall back to dn which is guaranteed.
                  data,
                  roles,
                  project: req.currentProject._id.toString(),
                  ldap: true
                };
                debug('Final user object', user);

                const token = {
                  external: true,
                  user,
                  form: {
                    _id: req.currentForm._id.toString()
                  },
                  project: {
                    _id: req.currentProject._id.toString()
                  }
                };
                debug('Token payload', token);

                return this.processAuth(req, res, data, user, token);
              });
            }
          );
        }
        catch (err) {
          if (err && (['Invalid Credentials'].includes(err) || !this.settings.passthrough)) {
            debug('Error occurred 1: ', err);
            return res.status(401).send(err);
          }
        }
    }
  }

  // Disable editing handler and method settings
  LDAPAction.access = {
    handler: false,
    method: false
  };

  // Return the LDAPAction.
  return LDAPAction;
};
