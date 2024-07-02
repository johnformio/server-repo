'use strict';

const {promisify} = require('util');
const util = require('formio/src/util/util');
const formioUtil = require('../../util/util');
const _ = require('lodash');
const crypto = require('crypto');
const base64url = require('base64url');
const fetch = require('node-fetch');

const qs = require('qs');
const chance = require('chance').Chance();
const {ObjectId} = require('mongodb');

const MAX_TIMESTAMP = 8640000000000000;

module.exports = router => {
  const formio = router.formio;
  const config = router.config;
  const {
    Action,
    hook
  } = router.formio;
  const oauthUtil = require('../../util/oauth')(formio);
  const auth = require('../../authentication/index')(formio);
  let codeVerifier = null;
  const currentUserPromise = promisify(router.formio.auth.currentUser);

  /**
   * OAuthAction class.
   * This class is used to create the OAuth action.
   */
  class OAuthAction extends Action {
    static async info(req, res, next) {
      try {
        const info = hook.alter('actionInfo', {
          name: 'oauth',
          title: 'OAuth',
          description: 'Provides OAuth authentication behavior to this form.',
          priority: 20,
          defaults: {
            handler: ['after'],
            method: ['form', 'create']
          }
        });
        return next(null, info);
      }
      catch (err) {
        return next(err);
      }
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
        const fieldsSrc = formio.hook.alter('path', `/form/${req.params.formId}/components`, req);
        const resourceFields = formio.hook.alter('path', '/{{data.settings.resource}}', req);
        const resourceSrc = formio.hook.alter('path', `/form?type=resource`, req);
        const roles = await formio.resources.role.model.find(formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req))
          .sort({title: 1})
          .lean()
          .exec();

        if (!roles) {
          return res.status(400).send('Could not load the Roles.');
        }

        const availableProviders = await oauthUtil.availableProviders(req, next);
        const form = await formio.cache.loadCurrentForm(req);

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
        return next(null, settingForm);
      }
      catch (err) {
        return next(err);
      }
    }

    async authenticate(req, res, provider, tokens) {
      let resource = null;
      const self = this;
      const userInfo = await provider.getUser(tokens);
      userInfo.email = await provider.getUserEmail(userInfo, req);
      const userId = await provider.getUserId(userInfo, req);
      resource = await formio.cache.loadFormByName(req, this.settings.resource);

      const result = await auth.authenticateOAuth(resource, provider.name, userId, req);
      if (result) { // Authenticated existing resource
        req.user = result.user;
        req.token = result.token.decoded;
        res.token = result.token.token;
        req.skipSave = true;
        req.noValidate = true;
        req['x-jwt-token'] = result.token.token;

        // Update external tokens with new tokens
        const externalTokens = _.uniqWith([...tokens, ...result.user.externalTokens], (a, b) => a.type === b.type);

        await formio.resources.submission.model.updateOne({
          _id: new ObjectId(result.user.id)
        }, {
          $set: {externalTokens}
        });
        // Manually invoke formio.auth.currentUser to trigger resourcejs middleware.
        return await currentUserPromise(req, res);
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
          const regex = new RegExp(`autofill-${  provider.name  }-(.+)`);
          if (provider.name === 'openid') {
            _.each(self.settings['openid-claims'], function(row) {
              if (row.field && _.has(userInfo, row.claim)) {
                _.set(req.submission.data, row.field, _.get(userInfo, row.claim));
              }
            });
          }
           else {
            _.each(self.settings, function(value, key) {
              const match = key.match(regex);
              if (match && value && userInfo[match[1]]) {
                req.submission.data[value] = userInfo[match[1]];
              }
            });
          }

          req.oauthDeferredAuth = {
            id: userId,
            provider: provider.name,
            tokens: tokens
          };

          const tmpPassword = `temp_${  chance.string({length: 16})}`;
          const fillPasswords = function(_form) {
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

          const currentForm = await formio.cache.loadCurrentForm(req);
          fillPasswords(currentForm);
          fillPasswords(resource);
        }
    }

    async reauthenticateNewResource(req, res, provider) {
      // Ensure we have a resource item saved before we get to this point.
      if (!res.resource || !res.resource.item || !res.resource.item._id) {
        return res.status(400).send('The OAuth Registration requires a Save Submission action added to the form actions.');
      }

      var self = this;
      // New resource was created and we need to authenticate it again and assign it an externalId
      // Also confirm role is actually accessible
      const roleQuery = formio.hook.alter('roleQuery', {_id: self.settings.role, deleted: {$eq: null}}, req);
      const [submission, resource, role] = await Promise.all([
        // Load submission
          formio.resources.submission.model.findOne({_id: res.resource.item._id, deleted: {$eq: null}}),
        // Load resource

          formio.cache.loadFormByName(req, self.settings.resource),
        // Load role

          formio.resources.role.model.findOne(roleQuery)
        ]);
        if (!submission) {
          throw {
             status: 404,
             message: `No submission found with _id: ${  res.resource.item._id}`
          };
        }
        if (!resource) {
          throw {
            status: 404,
            message: `No resource found with name: ${self.settings.resource}`
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

        await formio.resources.submission.model.updateOne({
          _id: submission.id
        }, {
          $set: submission
        });
        const result = await auth.authenticateOAuth(resource, provider.name, req.oauthDeferredAuth.id, req);
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
          return await currentUserPromise(req, res);
    }

    /**
     * Initialize the OAuth handler.
     *
     * @param req
     * @param res
     * @param next
     */
    async initialize(method, req, res, next) {
      try {
        const self = this;
        const provider = formio.oauth.providers[this.settings.provider];
        if (!req.body.oauth || !req.body.oauth[provider.name]) {
          return next();
        }

        // There is an oauth provided so we can skip other authentications
        req.skipAuth = true;

        // Get the response from OAuth.

        const oauthResponse = req.body.oauth[provider.name];
        const isPkce = _.get(req.currentProject, `settings.oauth.${provider.name}.authorizationMethod`) === 'pkce';

        if (!oauthResponse.code || (!oauthResponse.state && !isPkce) || !oauthResponse.redirectURI) {
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

        const tokensPromisePkce = async () => {
          const settings = await oauthUtil.settings(req, provider.name); // next
          /* eslint-disable camelcase */
          const params = {
            grant_type: "authorization_code",
            redirect_uri: oauthResponse.redirectURI,
            client_id: settings.clientId,
            code_verifier: codeVerifier,
            code: oauthResponse.code
          };
          /* eslint-enable camelcase */
          const response = await fetch(settings.tokenURI, {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            method: 'POST',
            body: qs.stringify(params)
          });
          const token = await response.json();
          codeVerifier = null;
          if (token.error) {
            return res.status(400).send(token.error_description || token.error);
          }
          return [
            {
              type: provider.name,
              userInfo: settings.userInfoURI,
              token: token.access_token || token.id_token || token.token,
              exp: new Date(MAX_TIMESTAMP),
            }
          ];
        };

        const getUserTeams = async (user) => {
          if (req.currentProject.primary && config.ssoTeams) {
            const userRoles = user.data?.groups || user.data?.roles || [];
            const teams = await formio.teams.getSSOTeams(user, userRoles);
            user.teams = _.map(_.map(teams || [], '_id'), formio.util.idToString);
            user.sso = true;
          }
          return user;
        };

        const tokensPromise = isPkce ? tokensPromisePkce() : provider.getTokens(req, oauthResponse.code, oauthResponse.state, oauthResponse.redirectURI);
        const tokens = await tokensPromise;

        switch (self.settings.association) {
          case 'new':
          case 'existing':
            await self.authenticate(req, res, provider, tokens);
            return next();
          case 'link': {
            req.skipSave = true;
            const userInfo = await provider.getUser(tokens);
            let currentUser = await currentUserPromise(req, res);

            const userIdLink = await provider.getUserId(userInfo, req);
            currentUser = res.resource.item;

            if (!currentUser) {
              throw {
                status: 401,
                message: `Must be logged in to link ${  provider.title  } account.`
              };
            }

              // Check if this account has already been linked
              const linkedSubmission = await formio.resources.submission.model.findOne({
              form: currentUser.form,
              externalIds: {
                $elemMatch: {
                  type: provider.name,
                  id: userIdLink
                }
              },
              deleted: {$eq: null}
            });

            if (linkedSubmission) {
              throw {
                status: 400,
                message: `This ${  provider.title  } account has already been linked.`
              };
            }
            // Need to get the raw user data so we can see the old externalTokens

            const userLink = await formio.resources.submission.model.findOne({
              _id: currentUser._id
            });
            await formio.resources.submission.model.updateOne({
              _id: userLink._id
            }, {
              $push: {
                // Add the external ids
                externalIds: {
                  type: provider.name,
                  id: userIdLink
                }
              },
              $set: {
                // Update external tokens with new tokens
                externalTokens: _(tokens).concat(userLink.externalTokens || []).uniq('type').value()
              }
            });
            await currentUserPromise(req, res);
            return next();
          }
          case 'remote': {
            const accessToken = _.find(tokens, {type: provider.name});
            const settings = await oauthUtil.settings(req, provider.name); // next
            const data = await provider.getUser(tokens, settings);

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

            await getUserTeams(user);

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

            await formio.hook.alter('oAuthResponse', req, res, async () => {
            // Set the headers if they haven't been sent yet.
              if (!res.headersSent) {
                const headers = formio.hook.alter('accessControlExposeHeaders', 'x-jwt-token');
                res.setHeader('Access-Control-Expose-Headers', headers);
                res.setHeader('x-jwt-token', res.token);
              }
              res.send(user);
              return user;
            });
          }
            break;
          default:
            break;
        }
      }
 catch (err) {
        this.onError(req, res, next)(err);
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
    async resolve(handler, method, req, res, next) {
      try {
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

        const self = this;
        const provider = formio.oauth.providers[this.settings.provider];

        // Modify the button to be an OAuth button
        if (
          handler === 'after' &&
          method === 'form' &&
          req.query.hasOwnProperty('live') && (parseInt(req.query.live, 10) === 1) &&
          res.hasOwnProperty('resource') &&
          res.resource.hasOwnProperty('item') &&
          res.resource.item._id
        ) {
          const settings = await formio.hook.settings(req);
          const component = util.getComponent(res.resource.item.components, this.settings.button);
          if (!component) {
            return next();
          }

          const state = crypto.randomBytes(64).toString('hex');
          if (provider.configureOAuthButton) { // Use custom provider configuration
            provider.configureOAuthButton(component, settings, state);
          }
           else { // Use default configuration, good for most oauth providers
            const oauthSettings = _.get(settings, `oauth.${provider.name}`);
            if (oauthSettings) {
              const isPkce = oauthSettings.authorizationMethod === 'pkce';
              if (!oauthSettings.clientId || (!oauthSettings.clientSecret && !isPkce)) {
                component.oauth = {
                  provider: provider.name,
                  error: `${provider.title} OAuth provider is missing client ID or client secret`
                };
              }
               else {
                component.oauth = {
                  provider: provider.name,
                  clientId: oauthSettings.clientId,
                  authURI: oauthSettings.authURI || provider.authURI,
                  redirectURI: self.settings.redirectURI,
                  scope: oauthSettings.scope || provider.scope,
                  logoutURI: oauthSettings.logout || null,
                };
                if (isPkce) {
                  const createCodeVerifier = ( size ) => {
                    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~';
                    const charsetIndexBuffer = new Uint8Array( size );

                    for ( let i = 0; i < size; i += 1 ) {
                      charsetIndexBuffer[i] = ( Math.random() * charset.length ) | 0;
                    }

                    const randomChars = [];
                    for ( let i = 0; i < charsetIndexBuffer.byteLength; i += 1 ) {
                      const index = charsetIndexBuffer[i] % charset.length;
                      randomChars.push( charset[index] );
                    }

                    return randomChars.join( '' );
                  };

                  if (!codeVerifier) {
                    codeVerifier = createCodeVerifier(50);
                  }

                  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
                  const codeChallenge = base64url.encode(hash);
                  /* eslint-disable camelcase */
                  component.oauth.code_challenge = codeChallenge;
                  /* eslint-enable camelcase */
                }
                 else {
                  component.oauth.state = state;
                }
                if (provider.display) {
                  component.oauth.display = provider.display;
                }
              }
            }
          }
          return next();
        }
        else if (
          handler === 'after' &&
          method === 'create' &&
          req.oauthDeferredAuth &&
          req.oauthDeferredAuth.provider === provider.name
        ) {
          await self.reauthenticateNewResource(req, res, provider);
          return next();
        }
       else {
          return next();
        }
      }
 catch (err) {
        this.onError(req, res, next)(err);
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
