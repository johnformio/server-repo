'use strict';

const util = require('formio/src/util/util');
const formioUtil = require('../../util/util');
const _ = require('lodash');
const crypto = require('crypto');
const Q = require('q');
const chance = require('chance').Chance();
const {ObjectId} = require('mongodb');

module.exports = router => {
  const formio = router.formio;
  const config = router.config;
  const {
    Action,
    hook
  } = router.formio;
  const oauthUtil = require('../../util/oauth')(formio);
  const auth = require('../../authentication/index')(formio);

  /**
   * OAuthAction class.
   *   This class is used to create the OAuth action.
   */
  class OAuthAction extends Action {
    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'oauth',
        title: 'OAuth',
        description: 'Provides OAuth authentication behavior to this form.',
        priority: 20,
        defaults: {
          handler: ['after'],
          method: ['form', 'create']
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
      var fieldsSrc = formio.hook.alter('path', `/form/${req.params.formId}/components`, req);
      var resourceFields = formio.hook.alter('path', '/{{data.settings.resource}}', req);
      var resourceSrc = formio.hook.alter('path', `/form?type=resource`, req);
      formio.resources.role.model.find(formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req))
        .sort({title: 1})
        .lean()
        .exec(function(err, roles) {
          if (err || !roles) {
            return res.status(400).send('Could not load the Roles.');
          }
          Q.all([
            oauthUtil.availableProviders(req),
            Q.ninvoke(formio.cache, 'loadCurrentForm', req)
          ])
            .spread(function(availableProviders, form) {
              const getOAuthActionButtons = () => {
                const buttons = [];

                util.eachComponent(form.components, (comp, path) => {
                  if (comp.type === 'button' && comp.action === 'oauth') {
                    buttons.push({...comp, path});
                  }
                });

                return buttons;
              };

              let settingForm = [
                {
                  type: 'select',
                  input: true,
                  label: 'OAuth Provider',
                  key: 'provider',
                  placeholder: 'Select the OAuth Provider',
                  template: '<span>{{ item.title }}</span>',
                  dataSrc: 'json',
                  data: {
                    json: JSON.stringify(availableProviders)
                  },
                  valueProperty: 'name',
                  multiple: false,
                  validate: {
                    required: true
                  }
                },
                {
                  type: 'select',
                  input: true,
                  label: 'Action',
                  key: 'association',
                  placeholder: 'Select the action to perform',
                  template: '<span>{{ item.title }}</span>',
                  dataSrc: 'json',
                  data: {
                    json: JSON.stringify([
                      {
                        association: 'remote',
                        title: 'Remote Authentication'
                      },
                      {
                        association: 'existing',
                        title: 'Login Existing Resource'
                      },
                      {
                        association: 'new',
                        title: 'Register New Resource'
                      },
                      {
                        association: 'link',
                        title: 'Link Current User'
                      }
                    ])
                  },
                  valueProperty: 'association',
                  multiple: false,
                  validate: {
                    required: true
                  }
                },
                {
                  type: 'select',
                  input: true,
                  label: 'Resource',
                  key: 'resource',
                  placeholder: 'Select the Resource to authenticate against',
                  template: '<span>{{ item.title }}</span>',
                  dataSrc: 'url',
                  data: {url: resourceSrc},
                  valueProperty: 'name',
                  authenticate: true,
                  multiple: false,
                  validate: {
                    required: true
                  },
                  customConditional: "show = ['existing', 'new'].indexOf(data.settings.association) !== -1;"
                },
                {
                  type: 'select',
                  input: true,
                  label: 'Role',
                  key: 'role',
                  placeholder: 'Select the Role that will be added to new Resources',
                  template: '<span>{{ item.title }}</span>',
                  dataSrc: 'json',
                  data: {json: roles},
                  valueProperty: '_id',
                  multiple: false,
                  customConditional: "show = ['new'].indexOf(data.settings.association) !== -1;"
                },
                {
                  type: 'select',
                  input: true,
                  label: 'Sign-in with OAuth Button',
                  key: 'button',
                  placeholder: 'Select the button that triggers OAuth sign-in',
                  template: '<span>{{ item.label || item.key }} ({{item.path}})</span>',
                  dataSrc: 'json',
                  data: {
                    json: JSON.stringify(getOAuthActionButtons())
                  },
                  valueProperty: 'path',
                  multiple: false,
                  validate: {
                    required: true
                  }
                },
                {
                  input: true,
                  tree: true,
                  components: [
                    {
                      input: true,
                      inputType: "text",
                      label: "Claim",
                      key: "claim",
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
                  type: "datagrid",
                  customConditional: "show = ['remote'].indexOf(data.settings.association) !== -1;"
                },
                {
                  type: 'textfield',
                  input: true,
                  label: 'OAuth Callback URL',
                  key: 'redirectURI',
                  placeholder: 'Enter Callback URL (Default window.location.origin of your app)',
                  multiple: false,
                  validate: {
                    required: false
                  }
                }
              ];

              const fieldMap = {
                type: "fieldset",
                components: [],
                legend: "Field Mapping",
                input: false,
                key: "fieldset",
                customConditional: "show = ['new'].indexOf(data.settings.association) !== -1;"
              };
              fieldMap.components = fieldMap.components.concat(
                _(formio.oauth.providers)
                  .map(function(provider) {
                    if (provider.name === 'openid') {
                      return {
                        input: true,
                        tree: true,
                        components: [
                          {
                            input: true,
                            inputType: "text",
                            label: "Claim",
                            key: "claim",
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
                            tableView: true,
                            label: "Field",
                            key: "field",
                            placeholder: "",
                            dataSrc: 'url',
                            data: {url: resourceFields},
                            valueProperty: 'key',
                            defaultValue: "",
                            refreshOn: "resource",
                            filter: "",
                            template: "<span>{{ item.label || item.key }}</span>",
                            multiple: false,
                            protected: false,
                            lazyLoad: false,
                            unique: false,
                            selectValues: 'components',
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
                        label: "Map Claims",
                        key: "openid-claims",
                        protected: false,
                        persistent: true,
                        hidden: false,
                        clearOnHide: true,
                        type: "datagrid",
                        customConditional: "show = ['openid'].indexOf(data.settings.provider) !== -1;"
                      };
                    }
                    else {
                      return _.map(provider.autofillFields, function(field) {
                        return {
                          type: 'select',
                          input: true,
                          label: `Autofill ${field.title} Field`,
                          key: `autofill-${provider.name}-${field.name}`,
                          placeholder: `Select which field to autofill with ${provider.title} account ${field.title}`,
                          template: '<span>{{ item.label || item.key }}</span>',
                          dataSrc: 'url',
                          data: {url: fieldsSrc},
                          valueProperty: 'key',
                          multiple: false,
                          customConditional: `show = ['${provider.name}'].indexOf(data.settings.provider) !== -1;`
                        };
                      });
                    }
                  })
                  .flatten()
                  .value()
              );
              settingForm = settingForm.concat(fieldMap);
              next(null, settingForm);
            })
            .catch(next);
        });
    }

    authenticate(req, res, provider, tokens) {
      var userInfo = null, userId = null, resource = null;
      var self = this;

      return Q.all([
        provider.getUser(tokens),
        Q.denodeify(formio.cache.loadFormByName.bind(formio.cache))(req, self.settings.resource)
      ])
        .then(async function(results) {
          userInfo = results[0];
          userInfo.email = await provider.getUserEmail(userInfo, req);
          userId = await provider.getUserId(userInfo, req);
          resource = results[1];
          return auth.authenticateOAuth(resource, provider.name, userId, req);
        })
        .then(function(result) {
          if (result) { // Authenticated existing resource
            req.user = result.user;
            req.token = result.token.decoded;
            res.token = result.token.token;
            req.skipSave = true;
            req.noValidate = true;
            req['x-jwt-token'] = result.token.token;

            // Update external tokens with new tokens
            const externalTokens = _.uniqWith([...tokens, ...result.user.externalTokens], (a, b) => a.type === b.type);

            return formio.resources.submission.model.updateOne({
              _id: ObjectId(result.user.id)
            }, {
              $set: {externalTokens}
            }).then(()=> {
              // Manually invoke formio.auth.currentUser to trigger resourcejs middleware.
              return Q.ninvoke(formio.auth, 'currentUser', req, res);
            });
          }
          else { // Need to create and auth new resource
            // If we were looking for an existing resource, return an error
            if (self.settings.association === 'existing') {
              throw {
                status: '404',
                message: `${provider.title  } account has not yet been linked.`
              };
            }

            // Add a default submission object.
            req.submission = req.submission || {data: {}};

            // Find and fill in all the autofill fields
            var regex = new RegExp(`autofill-${  provider.name  }-(.+)`);
            if (provider.name === 'openid') {
              _.each(self.settings['openid-claims'], function(row, key) {
                if (row.field && _.has(userInfo, row.claim)) {
                  _.set(req.submission.data, row.field, _.get(userInfo, row.claim));
                }
              });
            }
            else {
              _.each(self.settings, function(value, key) {
                var match = key.match(regex);
                if (match && value && userInfo[match[1]]) {
                  req.submission.data[value] = userInfo[match[1]];
                }
              });
            }

            // Add info so the after handler knows to auth
            req.oauthDeferredAuth = {
              id: userId,
              provider: provider.name,
              tokens: tokens
            };

            var tmpPassword = `temp_${  chance.string({length: 16})}`;
            var fillPasswords = function(_form) {
              util.eachComponent(_form.components, function(component) {
                if (
                  (component.type === 'password') &&
                  (component.persistent !== false) &&
                  (!req.submission.data[component.key])
                ) {
                  req.submission.data[component.key] = tmpPassword;
                }
              });
            };

            return Q.ninvoke(formio.cache, 'loadCurrentForm', req)
              .then(function(currentForm) {
                fillPasswords(currentForm);
                fillPasswords(resource);
              });
          }
        });
    }

    reauthenticateNewResource(req, res, provider) {
      // Ensure we have a resource item saved before we get to this point.
      if (!res.resource || !res.resource.item || !res.resource.item._id) {
        return res.status(400).send('The OAuth Registration requires a Save Submission action added to the form actions.');
      }

      var self = this;
      // New resource was created and we need to authenticate it again and assign it an externalId
      // Also confirm role is actually accessible
      var roleQuery = formio.hook.alter('roleQuery', {_id: self.settings.role, deleted: {$eq: null}}, req);
      return Q.all([
        // Load submission
        formio.resources.submission.model.findOne({_id: res.resource.item._id, deleted: {$eq: null}}),
        // Load resource
        Q.denodeify(formio.cache.loadFormByName.bind(formio.cache))(req, self.settings.resource),
        // Load role
        formio.resources.role.model.findOne(roleQuery)
      ])
        .spread(function(submission, resource, role) {
          if (!submission) {
            throw {
              status: 404,
              message: `No submission found with _id: ${  res.resource.item._id}`
            };
          }
          if (!resource) {
            throw {
              status: 404,
              message: `No resource found with name: ${  self.settings.resource}`
            };
          }
          if (!role) {
            throw {
              status: 404,
              message: 'The given role was not found.'
            };
          }

          // Add role and make sure only unique roles are present
          submission.roles = _.uniqWith([...submission.roles, role._id], (a, b) => a.toString() === b.toString());

          // Update the submissions owner.
          if (!submission.owner && submission.roles.length) {
            submission.owner = submission._id;
          }

          // Add external id
          submission.externalIds.push({
            type: provider.name,
            id: req.oauthDeferredAuth.id,
          });

          // Update external tokens with new tokens
          submission.externalTokens = _.uniqWith([...req.oauthDeferredAuth.tokens, ...submission.externalTokens], (a, b) => a.type === b.type);

          return formio.resources.submission.model.updateOne({
            _id: submission.id
          }, {
            $set: submission
          }).then(()=> {
            return auth.authenticateOAuth(resource, provider.name, req.oauthDeferredAuth.id, req);
          });
        })
        .then(function(result) {
          if (!result) {
            throw {
              status: 404,
              message: 'The given user was not found.'
            };
          }

          req.user = result.user;
          req.token = result.token.decoded;
          res.token = result.token.token;
          req['x-jwt-token'] = result.token.token;
          // Manually invoke formio.auth.currentUser to trigger resourcejs middleware.
          return Q.ninvoke(formio.auth, 'currentUser', req, res);
        });
    }

    /**
     * Initialize the OAuth handler.
     *
     * @param req
     * @param res
     * @param next
     */
    initialize(method, req, res, next) {
      var self = this;
      var provider = formio.oauth.providers[this.settings.provider];
      if (!req.body.oauth || !req.body.oauth[provider.name]) {
        return next();
      }

      // There is an oauth provided so we can skip other authentications
      req.skipAuth = true;

      // Get the response from OAuth.
      var oauthResponse = req.body.oauth[provider.name];

      if (!oauthResponse.code || !oauthResponse.state || !oauthResponse.redirectURI) {
        return res.status(400).send('No authorization code provided.');
      }

      this.triggeredBy = oauthResponse.triggeredBy;

      /*
        Needs for the exclude oAuth Actions that not related to the triggered action.
        Without this, we can face an error that the OAuth code has already been used.
      */

      if (this.triggeredBy && this.triggeredBy !== this.settings.button) {
        return next();
      }

      // Do not execute the form CRUD methods.
      req.skipResource = true;

      var getUserTeams = function(user) {
        return new Promise((resolve) => {
          if (req.currentProject.primary && config.ssoTeams) {
            formio.teams.getSSOTeams(user).then((teams) => {
              teams = teams || [];
              user.teams = _.map(_.map(teams, '_id'), formio.util.idToString);
              return resolve(user);
            }).catch(() => resolve(user));
          }
          else {
            resolve(user);
          }
        });
      };

      var tokensPromise = provider.getTokens(req, oauthResponse.code, oauthResponse.state, oauthResponse.redirectURI);
      switch (self.settings.association) {
        case 'new':
        case 'existing':
          return tokensPromise.then(function(tokens) {
            return self.authenticate(req, res, provider, tokens);
          })
            .then(function() {
              next();
            }).catch(this.onError(req, res, next));
        case 'link':
          var userId, currentUser, newTokens;
          req.skipSave = true;
          return tokensPromise.then(function(tokens) {
            newTokens = tokens;
            return Q.all([
              provider.getUser(tokens),
              Q.ninvoke(formio.auth, 'currentUser', req, res)
            ]);
          })
            .then(async function(results) {
              userId = await provider.getUserId(results[0], req);
              currentUser = res.resource.item;

              if (!currentUser) {
                throw {
                  status: 401,
                  message: `Must be logged in to link ${  provider.title  } account.`
                };
              }

              // Check if this account has already been linked
              return formio.resources.submission.model.findOne(
                {
                  form: currentUser.form,
                  externalIds: {
                    $elemMatch: {
                      type: provider.name,
                      id: userId
                    }
                  },
                  deleted: {$eq: null}
                }
              );
            })
            .then(function(linkedSubmission) {
              if (linkedSubmission) {
                throw {
                  status: 400,
                  message: `This ${  provider.title  } account has already been linked.`
                };
              }
              // Need to get the raw user data so we can see the old externalTokens
              return formio.resources.submission.model.findOne({
                _id: currentUser._id
              });
            })
            .then(function(user) {
              return formio.resources.submission.model.updateOne({
                _id: user._id
              }, {
                $push: {
                  // Add the external ids
                  externalIds: {
                    type: provider.name,
                    id: userId
                  }
                },
                $set: {
                  // Update external tokens with new tokens
                  externalTokens: _(newTokens).concat(user.externalTokens || []).uniq('type').value()
                }
              });
            })
            .then(function() {
              // Update current user response
              return Q.ninvoke(formio.auth, 'currentUser', req, res);
            })
            .then(function() {
              next();
            })
            .catch(this.onError(req, res, next));
        case 'remote':
          return tokensPromise
            .then((tokens) => {
              const accessToken = _.find(tokens, {type: provider.name});
              return oauthUtil.settings(req, provider.name)
                .then((settings) => provider.getUser(tokens, settings)
                  .then(async (data) => {
                    if (data.errorCode) {
                      throw new Error(data.errorSummary);
                    }

                    // Assign roles based on settings.
                    const roles = [];
                    _.map(this.settings.roles, map => {
                      if (!map.claim ||
                        _.get(data, map.claim) === map.value ||
                        _.includes(_.get(data, map.claim), map.value)
                      ) {
                        roles.push(map.role);
                      }
                    });

                    const userId = await provider.getUserId(data, req);
                    data.email = await provider.getUserEmail(data, req);
                    // Set LogOut URL per user to achieve the logout in Portal via OIDC
                    data.logoutURI =  settings.logout;
                    const user = {
                      _id: formioUtil.toMongoId(userId),
                      project: req.currentProject._id.toString(),
                      data,
                      roles
                    };

                    return getUserTeams(user);
                  })
                  .then((user) => {
                    const token = {
                      external: true,
                      user,
                      form: {
                        _id: req.currentForm._id.toString()
                      },
                      project: {
                        _id: req.currentProject._id.toString()
                      },
                      externalToken: accessToken
                    };

                    req.user = user;
                    req.token = token;
                    res.token = formio.auth.getToken(token);
                    req['x-jwt-token'] = res.token;

                    return formio.hook.alter('oAuthResponse', req, res, () => {
                      // Set the headers if they haven't been sent yet.
                      if (!res.headersSent) {
                        const headers = formio.hook.alter('accessControlExposeHeaders', 'x-jwt-token');
                        res.setHeader('Access-Control-Expose-Headers', headers);
                        res.setHeader('x-jwt-token', res.token);
                      }
                      res.send(user);
                      return user;
                    });
                  }),
                );
            })
            .catch(this.onError(req, res, next));
      }
    }

    /**
     * Authenticate with Form.io using OAuth
     *
     * Note: Requires req.body to contain an OAuth authorization code.
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
        return res.status(400).send('The OAuth Action requires a Role to be selected for new resources.');
      }

      if (this.settings.association === 'existing' && this.settings.hasOwnProperty('role') && this.settings.role) {
        this.settings = _.omit(this.settings, 'role');
      }

      if (!this.settings.provider) {
        return res.status(400).send('OAuth Action is missing Provider setting.');
      }

      // Non-link association requires a resource setting
      if (['existing', 'new'].indexOf(this.settings.association) !== -1 && !this.settings.resource) {
        return res.status(400).send('OAuth Action is missing Resource setting.');
      }

      if (!this.settings.button) {
        return res.status(400).send('OAuth Action is missing Button setting.');
      }

      if (this.triggeredBy && this.triggeredBy !== this.settings.button) {
        return next();
      }

      var self = this;
      var provider = formio.oauth.providers[this.settings.provider];

      // Modify the button to be an OAuth button
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
            if (provider.configureOAuthButton) { // Use custom provider configuration
              provider.configureOAuthButton(component, settings, state);
            }
            else { // Use default configuration, good for most oauth providers
              var oauthSettings = _.get(settings, `oauth.${  provider.name}`);
              if (oauthSettings) {
                if (!oauthSettings.clientId || !oauthSettings.clientSecret) {
                  component.oauth = {
                    provider: provider.name,
                    error: `${provider.title  } OAuth provider is missing client ID or client secret`
                  };
                }
                else {
                  component.oauth = {
                    provider: provider.name,
                    clientId: oauthSettings.clientId,
                    authURI: oauthSettings.authURI || provider.authURI,
                    redirectURI: self.settings.redirectURI,
                    state: state,
                    scope: oauthSettings.scope || provider.scope,
                    logoutURI: oauthSettings.logout || null,
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

    onError(req, res, next) {
      return function(err) {
        if (err.status) {
          return res.status(err.status).send(err.message);
        }
        next(err);
      };
    }
  }

  // Disable editing handler and method settings
  OAuthAction.access = {
    handler: false,
    method: false
  };

  // Return the OAuthAction.
  return OAuthAction;
};
