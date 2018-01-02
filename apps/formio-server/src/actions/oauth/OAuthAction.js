'use strict';

const util = require('formio/src/util/util');
const debug = require('debug')('formio:action:oauth');
const _ = require('lodash');
const crypto = require('crypto');
const Q = require('q');
const chance = require('chance').Chance();

module.exports = function(router) {
  const formio = router.formio;
  const hook = router.formio.hook;
  const oauthUtil = require('../../util/oauth')(formio);
  const auth = require('../../authentication/index')(formio);

  /**
   * OAuthAction class.
   *   This class is used to create the OAuth action.
   *
   * @constructor
   */
  const OAuthAction = function(data, req, res) {
    formio.Action.call(this, data, req, res);
  };

  // Derive from Action.
  OAuthAction.prototype = Object.create(formio.Action.prototype);
  OAuthAction.prototype.constructor = OAuthAction;
  OAuthAction.info = function(req, res, next) {
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
  };
  // Disable editing handler and method settings
  OAuthAction.access = {
    handler: false,
    method: false
  };

  /**
   * Settings form for auth action.
   *
   * @param req
   * @param res
   * @param next
   */
  OAuthAction.settingsForm = function(req, res, next) {
    const fieldsSrc = formio.hook.alter('path', `/form/${req.params.formId}/components`, req);
    const resourceSrc = formio.hook.alter('path', '/form?type=resource', req);
    formio.resources.role.model.find(formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req))
      .sort({title: 1})
      .exec(function(err, roles) {
        if (err || !roles) {
          return res.status(400).send('Could not load the Roles.');
        }
        Q.all([
          oauthUtil.availableProviders(req),
          Q.ninvoke(formio.cache, 'loadCurrentForm', req)
        ])
        .spread(function(availableProviders, form) {
          next(null, [
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
              multiple: false,
              validate: {
                required: true
              }
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
              multiple: false
            },
            {
              type: 'select',
              input: true,
              label: 'Sign-in with OAuth Button',
              key: 'button',
              placeholder: 'Select the button that triggers OAuth sign-in',
              template: '<span>{{ item.label || item.key }}</span>',
              dataSrc: 'json',
              data: {
                json: JSON.stringify(_.filter(form.components, {type: 'button', action: 'oauth'}))
              },
              valueProperty: 'key',
              multiple: false,
              validate: {
                required: true
              }
            }
          ]
          .concat(
            _(formio.oauth.providers)
            .map(function(provider) {
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
                  multiple: false
                };
              });
            })
            .flatten()
            .value()
          ));
        })
        .catch(next);
      });
  };

  OAuthAction.prototype.authenticate = function(req, res, provider, tokens) {
    debug('Authenticating with Tokens:', tokens);

    let userInfo = null, userId = null, resource = null;
    const self = this;

    return Q.all([
      provider.getUser(tokens),
      Q.denodeify(formio.cache.loadFormByName.bind(formio.cache))(req, self.settings.resource)
    ])
    .then(function(results) {
      userInfo = results[0];
      userId = provider.getUserId(userInfo);
      resource = results[1];

      debug('userInfo:', userInfo);
      debug('userId:', userId);

      return auth.authenticateOAuth(resource, provider.name, userId);
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
        result.user.set('externalTokens',
          _(tokens).concat(result.user.externalTokens).uniq('type').value()
        );

        return result.user.save()
        .then(function() {
          // Manually invoke formio.auth.currentUser to trigger resourcejs middleware.
          return Q.ninvoke(formio.auth, 'currentUser', req, res);
        });
      }
      else { // Need to create and auth new resource
        // If we were looking for an existing resource, return an error
        if (self.settings.association === 'existing') {
          throw {
            status: '404',
            message: `${provider.title} account has not yet been linked.`
          };
        }

        // Add a default submission object.
        req.submission = req.submission || {data: {}};

        // Find and fill in all the autofill fields
        const regex = new RegExp(`autofill-${provider.name}-(.+)`);
        _.each(self.settings, function(value, key) {
          const match = key.match(regex);
          if (match && value && userInfo[match[1]]) {
            req.submission.data[value] = userInfo[match[1]];
          }
        });

        // Add info so the after handler knows to auth
        req.oauthDeferredAuth = {
          id: userId,
          provider: provider.name,
          tokens: tokens
        };
        debug('oauthDeferredAuth: ', req.oauthDeferredAuth);

        debug('Filling in dummy passwords');
        const tmpPassword = `temp_${chance.string({length: 16})}`;
        const fillPasswords = function(_form) {
          util.eachComponent(_form.components, function(component) {
            if (
              (component.type === 'password') &&
              (component.persistent !== false) &&
              (!req.submission.data[component.key])
            ) {
              req.submission.data[component.key] = tmpPassword;
              debug(component.key, 'is now', req.submission.data[component.key]);
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
  };

  OAuthAction.prototype.reauthenticateNewResource = function(req, res, provider) {
    const self = this;
    // New resource was created and we need to authenticate it again and assign it an externalId
    // Also confirm role is actually accessible
    const roleQuery = formio.hook.alter('roleQuery', {_id: self.settings.role, deleted: {$eq: null}}, req);
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
          message: `No submission found with _id: ${res.resource.item._id}`
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

      // Add role
      // Convert to just the roleId
      debug(role);
      role = role.toObject()._id.toString();

      // Add and store unique roles only.
      let temp = submission.toObject().roles || [];
      temp = _.map(temp, function(r) {
        return r.toString();
      });
      debug(`Adding: ${role}`);
      temp.push(role);
      temp = _.uniq(temp);
      temp = _.map(temp, function(r) {
        return formio.mongoose.Types.ObjectId(r);
      });

      // Update the submissions owner, if set.
      if (_.has(req, 'selfOwner')&& req.selfOwner) {
        submission.owner = submission._id;
      }

      // Update and save the submissions roles.
      submission.set('roles', temp);

      // Add external id
      submission.externalIds.push({
        type: provider.name,
        id: req.oauthDeferredAuth.id
      });

      // Update external tokens with new tokens
      submission.set('externalTokens',
        _(req.oauthDeferredAuth.tokens).concat(submission.externalTokens).uniq('type').value()
      );
      debug('externalTokens: ', submission.externalTokens);

      return submission.save()
      .then(function() {
        return auth.authenticateOAuth(resource, provider.name, req.oauthDeferredAuth.id);
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
  };

  /**
   * Initialize the OAuth handler.
   *
   * @param req
   * @param res
   * @param next
   */
  OAuthAction.prototype.initialize = function(method, req, res, next) {
    const self = this;
    const provider = formio.oauth.providers[this.settings.provider];
    if (!req.body.oauth || !req.body.oauth[provider.name]) {
      return next();
    }

    // There is an oauth provided so we can skip other authentications
    req.skipAuth = true;

    // Get the response from OAuth.
    const oauthResponse = req.body.oauth[provider.name];

    if (!oauthResponse.code || !oauthResponse.state || !oauthResponse.redirectURI) {
      return res.status(400).send('No authorization code provided.');
    }

    // Do not execute the form CRUD methods.
    req.skipResource = true;

    const tokensPromise = provider.getTokens(req, oauthResponse.code, oauthResponse.state, oauthResponse.redirectURI);
    if (self.settings.association === 'new' || self.settings.association === 'existing') {
      return tokensPromise.then(function(tokens) {
          return self.authenticate(req, res, provider, tokens);
        })
        .then(function() {
          next();
        }).catch(this.onError(req, res, next));
    }
    else if (self.settings.association === 'link') {
      let userId, currentUser, newTokens;
      req.skipSave = true;
      return tokensPromise.then(function(tokens) {
          newTokens = tokens;
          return Q.all([
            provider.getUser(tokens),
            Q.ninvoke(formio.auth, 'currentUser', req, res)
          ]);
        })
        .then(function(results) {
          userId = provider.getUserId(results[0]);
          currentUser = res.resource.item;
          debug('userId:', userId);
          debug('currentUser:', currentUser);

          if (!currentUser) {
            throw {
              status: 401,
              message: `Must be logged in to link ${provider.title} account.`
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
        }).then(function(linkedSubmission) {
          if (linkedSubmission) {
            throw {
              status: 400,
              message: `This ${provider.title} account has already been linked.`
            };
          }
          // Need to get the raw user data so we can see the old externalTokens
          return formio.resources.submission.model.findOne({
            _id: currentUser._id
          });
        }).then(function(user) {
          return formio.resources.submission.model.update({
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
        }).catch(this.onError(req, res, next));
    }
  };

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
  OAuthAction.prototype.resolve = function(handler, method, req, res, next) {
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
    if (this.settings.association !== 'link' && !this.settings.resource) {
      return res.status(400).send('OAuth Action is missing Resource setting.');
    }

    if (!this.settings.button) {
      return res.status(400).send('OAuth Action is missing Button setting.');
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
      debug('Modifying Oauth Button');
      return Q.ninvoke(formio.hook, 'settings', req)
      .then(function(settings) {
        const component = util.getComponent(res.resource.item.components, self.settings.button);
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
            if (!oauthSettings.clientId || !oauthSettings.clientSecret) {
              component.oauth = {
                provider: provider.name,
                error: `${provider.title} OAuth provider is missing client ID or client secret`
              };
            }
            else {
              component.oauth = {
                provider: provider.name,
                clientId: oauthSettings.clientId,
                authURI: provider.authURI,
                state: state,
                scope: provider.scope
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
  };
  /* eslint-enable max-depth */

  OAuthAction.prototype.onError = function(req, res, next) {
    return function(err) {
      if (err.status) {
        debug('Error', err);
        return res.status(err.status).send(err.message);
      }
      next(err);
    };
  };

  // Return the OAuthAction.
  return OAuthAction;
};
