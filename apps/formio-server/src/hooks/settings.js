'use strict';

const _ = require('lodash');
const nodeUrl = require('url');
const semver = require('semver');
const async = require('async');
const fs = require('fs');
const log = require('debug')('formio:log');
const util = require('../util/util');
const {evaluateSync} = require('@formio/vm');
const {ClientCredentials} = require('simple-oauth2');
const moment = require('moment');
const config = require('../../config');
const ActionLogger = require('../actions/ActionLogger');
const debug = {
  authentication: require('debug')('formio:authentication'),
};
const updateSecret = require('../util/updateSecret.js');

module.exports = function(app) {
  const formioServer = app.formio;
  const audit = formioServer.formio.audit;
  // Add the encrypt handler.
  const encrypt = require('../util/encrypt')(formioServer);

  // Attach the project plans to the formioServer
  formioServer.formio.plans = require('../plans/index')(formioServer);

  // Attach the teams to formioServer.
  formioServer.formio.teams = require('../teams/index')(app, formioServer);

  // Handle Payment Gateway form signing requests and project upgrades
  app.formio.formio.payment = require('../payment/payment')(app, app.formio.formio);

  return {
    settings(settings, req, cb) {
      if (!req.projectId) {
        if (settings !== undefined) {
          return cb(null, settings);
        }

        return cb('No project ID provided.');
      }

      // Load the project settings.
      formioServer.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return cb(err);
        }
        if (!project) {
          return cb('Could not find project');
        }

        // Call the callback with the project settings.
        cb(null, project.settings);
      });
    },
    on: {
      init: require('./on/init')(app),
      formRequest: require('./on/formRequest')(app),
      validateEmail: require('./on/validateEmail')(app),
    },
    alter: {
      logAction(req, res, action, handler, method, cb) {
        const allowLogs = _.get(req.currentForm, 'settings.logs', false) &&
          ((config.formio.hosted && ['trial', 'commercial'].includes(req.primaryProject.plan)) ||
            (!config.formio.hosted && app.license && !app.license.licenseServerError && app.license.terms && _.get(
              app,
              'license.terms.options.sac',
              false,
            )));

        if (allowLogs) {
          new ActionLogger(app.formio, req, res, action, handler, method).log(cb);
        }
        else {
          return cb(null, false);
        }
      },
      formio: require('./alter/formio')(app),
      resources(resources) {
        return _.assign(resources, require('../resources/resources')(app, formioServer));
      },
      alias(alias, req, res) {
        // See if this is our validate endpoint
        if (req.method === 'POST' && alias.match(/\/validate$/)) {
          return alias.replace(/\/validate$/, '');
        }
        else if (req.url.includes('/pdf-proxy')) {
          return false;
        }
        else {
          return alias;
        }
      },
      FormResource: require('./alter/FormResource')(app),
      models: require('./alter/models')(app),
      email: require('./alter/email')(app),
      validationDatabaseHooks: require('./alter/validationDatabaseHooks')(app),
      serverRules: require('./alter/serverRules.js')(app),
      validateSubmissionForm: require('./alter/validateSubmissionForm')(app),
      currentUser: require('./alter/currentUser')(app),
      accessInfo: require('./alter/accessInfo')(app),
      loadForm: require('./alter/loadForm')(app).hook,
      formResponse: require('./alter/loadForm')(app).hook,
      evalContext: require('./alter/evalContext')(app),
      actions: require('./alter/actions')(app),
      actionContext: require('./alter/actionContext')(app),
      fieldActions: require('./alter/fieldActions')(app),
      propertyActions: require('./alter/propertyActions')(app),
      configFormio: require('./alter/configFormio'),
      loadRevision: require('./alter/loadRevision')(app),
      parentProjectSettings: require('./alter/parentProjectSettings')(app),
      rawDataAccess: require('./alter/rawDataAccess'),
      rehydrateValidatedSubmissionData: require('./alter/rehydrateValidatedSubmissionData')(app),
      dynamicVmDependencies: require('./alter/dynamicVmDependencies')(app),
      schemaIndex(index) {
        index.project = 1;
        return index;
      },
      log() {
        const [event, req, ...args] = arguments;
        log(req.uuid, req.projectId || 'NoProject', event, ...args);

        return false;
      },
      audit(args, event, req) {
        if (!app.formio.formio.config.audit || !_.get(app, 'license.terms.options.sac', false) || process.env.TEST_SUITE) {
          return false;
        }
        args.unshift(new Date());
        args.splice(1, 0, event);
        args.splice(2, 0, req.uuid);
        args.splice(3, 0, req.projectId || 'NoProject');
        args.splice(4, 0, req.session ? req.session._id : 'NoSession');
        args.splice(5, 0, req.userId || (req.user ? req.user._id : 'NoUser'));

        return args;
      },
      decrypt(req, data) {
        const currentProject = formioServer.formio.cache.currentProject(req);
        const secret = currentProject && _.get(app, 'license.terms.options.sac', false)
          ? currentProject.settings.secret || config.formio.mongoSecret
          : null;

        return secret ? util.decrypt(secret, data) : data;
      },
      export(req, query, form, exporter, cb) {
        util.getSubmissionModel(formioServer.formio, req, form, true, (err, submissionModel) => {
          if (err) {
            return cb(err);
          }

          if (form && form.name === 'license2' && exporter && exporter.addCustomTransformer) {
            exporter.addCustomTransformer('user', (value) => {
              return value.map(item => _.get(item, 'data.email', ''));
            });
          }

          req.flattenedComponents = formioServer.formio.util.flattenComponents(form.components, true);
          encrypt.hasEncryptedComponents(req);

          if (!submissionModel) {
            return cb();
          }

          req.submissionModel = submissionModel;
          return cb();
        });
      },

      /**
       * Alter specific actions to be flagged as premium actions.
       *
       * @param title
       */
      actionInfo(action) {
        // Modify premium actions if present.
        const premium = [
          'webhook',
          'oauth',
          'googlesheet',
          'ldap',
          'sqlconnector',
          'esign',
          'twofalogin',
          'twofarecoverylogin'
        ];
        if (action.title && action.name && !action.premium && premium.includes(action.name)) {
          action.title += ' (Premium)';
          action.premium = true;
        }

        if (action.name === 'email' && action.settingsForm) {
          // Add the "Attach PDF" checkbox to the email action.
          action.settingsForm.components.forEach((component) => {
            if (component.type === 'fieldset' && component.legend === 'Action Settings') {
              component.components.forEach((subComp) => {
                if (subComp.key === 'settings') {
                  subComp.components.push({
                    type: 'checkbox',
                    input: true,
                    key: 'attachFiles',
                    label: 'Attach Submission Files',
                    tooltip: 'Check this if you would like to attach submission files to the email.',
                  });

                  subComp.components.push({
                    type: 'checkbox',
                    input: true,
                    key: 'attachPDF',
                    label: 'Attach Submission PDF',
                    /* eslint-disable max-len */
                    tooltip: 'Check this if you would like to attach a PDF of the submission to the email. This will count toward your PDF Submission count for every email sent.',
                    /* eslint-enable max-len */
                  });

                  subComp.components.push({
                    type: 'textfield',
                    input: true,
                    key: 'pdfName',
                    label: 'PDF File Name',
                    defaultValue: '{{ form.name }}-{{ submission._id }}',
                    tooltip: 'Determines how the submission PDF is named when it is attached.',
                    customConditional: 'show = !!data.settings.attachPDF;',
                  });
                }
              });
            }
          });
        }

        return action;
      },

      /**
       * Skip premium actions, on non premium plans.
       *
       * @param action
       * @param handler
       * @param method
       * @param req
       * @param res
       * @param next
       */
      resolve(defaultReturn, action, handler, method, req, res) {
        const premium = [
          'webhook', 'oauth', 'googlesheet', 'ldap', 'esign', 'twofalogin', 'twofarecoverylogin'
        ];

        // If the action does not have a name, or is not flagged as being premium, ignore it.
        if (!action.hasOwnProperty('name') || !premium.includes(action.name)) {
          return true;
        }
        if (['basic', 'independent', 'archived'].includes(req.primaryProject.plan)) {
          return false;
        }

        return true;
      },

      emailTransports(transports, settings, req, cb) {
        settings = settings || {};
        if (req && req.primaryProject) {
          if (!config.formio.hosted && process.env.DEFAULT_TRANSPORT) {
            transports.push({
              transport: 'default',
              title: 'Default'
            });
          }
        }
        return cb(null, transports);
      },
      hasEmailAccess(req) {
        const noEmailPlans = ['basic', 'archived'];
        return !(req.currentProject && noEmailPlans.includes(req.currentProject.plan));
      },
      path(url, req) {
        return `/project/${req.projectId}${url}`;
      },
      skip(_default, req) {
        if (req.isAdmin) {
          return true;
        }
        if (req.url.indexOf(`/project/${req.projectId}/saml/`) === 0) {
          return true;
        }
        if (req.url.indexOf(`/project/${req.projectId}/config.json`) === 0) {
          return true;
        }
        if (req.url.indexOf(`/project/${req.projectId}/manage`) === 0) {
          return true;
        }
        if (req.url.includes('/pdf-proxy')) {
          return true;
        }

        if (req.headers['x-jwt-token'] && req.user) {
          const whitelist2fa = ['/2fa/generate', '/2fa/represent', '/2fa/turn-on', '/2fa/turn-off'];
          const url = req.url.split('?')[0];
          const is2fa = _.some(whitelist2fa, (path) => {
            if ((url === path) || (url === this.path(path, req))) {
              return true;
            }

            return false;
          });

          if (is2fa) {
            return true;
          }
        }

        if (req.method !== 'GET') {
          return false;
        }

        if (
          req.url === '/'
          && (req.hasOwnProperty('projectId') === false || req.projectId === undefined || req.projectId === '')
        ) {
          return true;
        }

        return false;
      },
      fieldUrl(url, form, field) {
        return `/project/${form.project}${url}`;
      },
      host(host, req) {
        // Load the project settings.
        const project = formioServer.formio.cache.currentProject(req);
        return `${project.name}.${host}`;
      },

      /**
       * Modify the given token.
       *
       * @param token {Object}
       *   The initial formio user token.
       * @param form {Object}
       *   The initial formio user resource form.
       * @param req
       *   Request
       *
       * @returns {Object}
       *   The modified token.
       */
      token(token, form, req) {
        const is2FaEnabled = _.get((req), 'user.data.twoFactorAuthenticationEnabled', false);
        const code2Fa = _.get((req), 'user.data.twoFactorAuthenticationCode', null);
        const {isSecondFactorAuthenticated} = token;
        if (is2FaEnabled && code2Fa && !isSecondFactorAuthenticated) {
          token.isSecondFactorAuthenticated = false;
        }

        // See https://tools.ietf.org/html/rfc7519
        token.iss = util.baseUrl(formioServer.formio, req);
        token.sub = token.user._id;
        token.jti = req.session._id;

        // form and project are now stored in session so no longer need to include it in the token.
        delete token.form;
        delete token.project;

        return token;
      },

      /**
       * Token has just been decoded, make sure all the correct data is there.
       *
       * @param content
       * @param req
       * @param cb
       */
      tokenDecode(token, req, cb) {
        // Do not use if a sessionKey has been provided by an external token, or if jti is not available.
        if (!token.jti || token.sessionKey) {
          return cb(null, token);
        }
        const returnToken = () => {
          return cb(null, {
            ...token,
            form: {
              _id: req.session.form ? req.session.form.toString() : '',
              project: req.session.project ? req.session.project.toString() : '',
            },
            project: {
              _id: req.session.project ? req.session.project.toString() : '',
            },
          });
        };
        if (req.session) {
          return returnToken();
        }
        return formioServer.formio.mongoose.models.session.findById(token.jti)
          .then((session) => {
            if (!session) {
              return cb(null, token);
            }

            req.session = session.toObject();
            return returnToken();
          });
      },

      /**
       * Modify the temp token to add a token id to it.
       *
       * @param req
       * @param res
       * @param allow
       * @param expire
       * @param tokenResponse
       * @param cb
       */
      tempToken(req, res, allow, expire, tokenResponse, cb) {
        // Save to mongo
        formioServer.formio.mongoose.models.token.create({
          value: tokenResponse.token,
          expireAt: (expire || expire === 0) ? Date.now() + (expire * 1000) : null
        }, (err, token) => {
          if (err) {
            return res.status(400).send(err.message);
          }

          tokenResponse.key = token.key;

          return cb();
        });
      },

      /**
       * Called when the user is logged in.
       *
       * @param user
       * @param req
       * @param cb
       * @returns {*}
       */
      login(user, req, cb) {
        const sessionModel = formioServer.formio.mongoose.models.session;

        sessionModel.create({
          project: user.project._id,
          form: user.form._id,
          submission: user._id,
          source: 'login',
        })
          .catch(cb)
          .then((session) => {
            req.session = session.toObject();
            req.user = user;
            audit('AUTH_LOGIN', req);
            cb();
          });
      },

      /**
       * See if a token is valid.
       *
       * @param req
       * @param decoded
       * @param user
       * @param cb
       * @returns {*}
       */
      validateToken(req, decoded, user, cb) {
        // If this is an external token, don't try to check for a session.
        if ('external' in decoded && decoded.external) {
          return cb();
        }

        // If this token was provided by an external entity, then skip sessions as well.
        if (decoded.sessionKey) {
          return cb();
        }

        if (!decoded.jti) {
          return cb(new Error('Missing session.'));
        }

        req.skipTokensValidation = true;
        if (!req.session) {
          return cb('Session not found.');
        }
        if (req.session.logout) {
          return cb('Session no longer valid.');
        }

        const {
          session: sessionConfig,
        } = formioServer.formio.config;

        const now = Date.now();

        if (sessionConfig.expireTime !== '' && (now - req.session.created) > (sessionConfig.expireTime * 60 * 1000)) {
          return cb('Session expired.');
        }

        return cb();
      },

      invalidateTokens(req, res, cb) {
        const userId = req.params.submissionId;
        if (!userId) {
          return cb(new Error('No user found.'));
        }
        if (req.body.owner && userId !==  req.body.owner) {
          return cb();
        }

        audit('AUTH_PASSWORD', req);

        req.skipTokensInvalidation = true;

        const sessionQuery = {
          submission: formioServer.formio.util.idToBson(userId),
          logout: {$eq: null},
        };

        if (req.session && req.session._id) {
          _.set(sessionQuery, '_id', {$ne: formioServer.formio.util.idToBson(req.session._id)});
        }

        return formioServer.formio.mongoose.models.session.updateMany(sessionQuery,
        {
          logout: Date.now(),
        })
          .catch(cb)
          .then(() => cb());
      },

      isAdmin(isAdmin, req) {
        // Allow super admins to have admin access.
        if (util.isSuperAdmin(req)) {
          req.adminKey = true;
          return true;
        }
        // Allow remote team admins to have admin access.
        if (req.remotePermission && ['admin', 'owner', 'team_admin'].indexOf(req.remotePermission) !== -1) {
          return true;
        }

        // Allow access to the tenant with access team_admin
        if (req.currentProject?.type === 'tenant' && req.userProject?.primary && _.get(req.user, `access.${req.currentProject.name}`, '') === 'team_admin') {
          return true;
        }

        // If no user is found, then return false.
        if (!req.token || !req.token.user) {
          return false;
        }

        // Ensure we have a projectOwner
        if (!req.projectOwner) {
          return false;
        }
        // Return false if the user doesn't authenticated with 2FA
        if (!formioServer.formio.twoFa.is2FAuthenticated(req)) {
          return false;
        }

        // Project owners are default admins.
        if (req.token.user._id === req.projectOwner) {
          return true;
        }

        return false;
      },

      /**
       * Modify the access handlers.
       *
       * @param handlers {Array}
       *   The array of handlers for the access endpoints.
       * @param req {Object}
       *   The Express request Object.
       * @param res {Object}
       *   The Express request Object.
       * @param access {Object}
       *   The formio access object.
       *
       * @returns {Array}
       *   The modified access handlers.
       */
      getAccess(handlers, req, res, access) {
        /**
         * Calculate the project access.
         *
         * @param callback {Function}
         *   The callback function to invoke after completion.
         */
        const getProjectAccess = function(callback) {
          // Build the access object for this project.
          access.project = {};

          // Skip project access if no projectId was given.
          if (!req.projectId) {
            return callback(null);
          }

          // Load the project.
          formioServer.formio.cache.loadProject(req, req.projectId, function(err, project) {
            if (err) {
              return callback(err);
            }
            if (!project) {
              return callback(`No project found with projectId: ${req.projectId}`);
            }

            req.currentProject = project;
            formioServer.formio.cache.loadPrimaryProject(req, function(err, primaryProject) {
              req.primaryProject = primaryProject;

              // Store the Project Owners UserId, because they will have all permissions.
              if (req.primaryProject && req.primaryProject.owner) {
                access.project.owner = req.primaryProject.owner.toString();

                // Add the UserId of the Project Owner for the ownerFilter middleware.
                req.projectOwner = access.project.owner;
              }

              // Add the other defined access types.
              if (project.access) {
                project.access.forEach(function(permission) {
                  access.project[permission.type] = access.project[permission.type] || [];

                  // Convert the roles from BSON to comparable strings.
                  permission.roles.forEach(function(id) {
                    access.project[permission.type].push(id.toString());
                  });
                });
              }

              // Pass the access of this project to the next function.
              return callback(null);
            });
          });
        };

        /**
         * Calculate the team access.
         *
         * @param callback {Function}
         *   The callback function to invoke after completion.
         */
        const getTeamAccess = function(callback) {
          // Modify the project access with teams functionality.
          access.project = access.project || {};

          // Skip teams access if no projectId was given.
          if (!req.projectId) {
            return callback(null);
          }

          formioServer.formio.cache.loadCurrentProject(req, function(err, currentProject) {
            // Load the primary project.
            /* eslint-disable camelcase, max-statements, no-fallthrough */
            formioServer.formio.cache.loadPrimaryProject(req, function(err, primaryProject) {
              if (err) {
                return callback(err);
              }
              if (!primaryProject) {
                return callback(`No project found with projectId: ${req.projectId}`);
              }

              // Skip teams processing, if this projects plan does not support teams.
              if (['basic', 'independent', 'archived'].includes(primaryProject.plan)) {
                return callback(null);
              }

              // Iterate the project access permissions, and search for teams functionality.
              if (primaryProject.access) {
                const teamAccess = _.filter(primaryProject.access, function(permission) {
                  return _.startsWith(permission.type, 'team_');
                }).concat(_.filter(currentProject.access, function(permission) {
                  return _.startsWith(permission.type, 'stage_');
                }));

                if (req.currentProject?.type === 'tenant' && req.userProject?.name === 'formio') {
                  if (req.access && _.includes(_.keys(req.access), req.currentProject.name)) {
                    _.find(teamAccess, {type: req.access[req.currentProject.name]}).roles.push(req.user._id.toString());
                  }
                  if (req.user && req.user.sso && req.user.access && _.includes(_.keys(req.user.access), req.currentProject.name)) {
                    _.find(teamAccess, {type: req.user.access[req.currentProject.name]}).roles.push(req.user._id.toString());
                  }
                }

                // Initialize the project access.
                access.project = access.project || {};
                access.project.create_all = access.project.create_all || [];
                access.project.read_all = access.project.read_all || [];
                access.project.update_all = access.project.update_all || [];
                access.project.delete_all = access.project.delete_all || [];

                // Initialize the form access.
                access.form = access.form || {};
                access.form.create_all = access.form.create_all || [];
                access.form.read_all = access.form.read_all || [];
                access.form.update_all = access.form.update_all || [];
                access.form.delete_all = access.form.delete_all || [];

                // Initialize the submission access.
                access.submission = access.submission || {};
                access.submission.create_all = access.submission.create_all || [];
                access.submission.read_all = access.submission.read_all || [];
                access.submission.update_all = access.submission.update_all || [];
                access.submission.delete_all = access.submission.delete_all || [];

                // Initialize the role access.
                access.role = access.role || {};
                access.role.create_all = access.role.create_all || [];
                access.role.read_all = access.role.read_all || [];
                access.role.update_all = access.role.update_all || [];
                access.role.delete_all = access.role.delete_all || [];

                const isFormCreation = req.method === 'POST' && req.url.endsWith('/form');
                const isPdfUploading = req.method === 'POST' && req.url.endsWith('/upload');

                teamAccess.forEach(function(permission) {
                  permission.roles = permission.roles || [];
                  // Note: These roles are additive. team_admin gets all roles in team_write and team_read.
                  // Iterate each team in the team roles, and add their permissions.
                  permission.roles.forEach(function(id) {
                    switch (permission.type) {
                      case 'team_admin':
                        access.project.update_all.push(id.toString());
                        access.project.delete_all.push(id.toString());
                      case 'team_write':
                      case 'stage_write':
                        if (isFormCreation || isPdfUploading || permission.type === 'team_admin') {
                          access.project.create_all.push(id.toString()); // This controls form creation.
                        }
                        access.form.create_all.push(id.toString());
                        access.form.update_all.push(id.toString());
                        access.form.delete_all.push(id.toString());
                        access.submission.create_all.push(id.toString());
                        access.submission.update_all.push(id.toString());
                        access.submission.delete_all.push(id.toString());
                        access.role.create_all.push(id.toString());
                        access.role.update_all.push(id.toString());
                        access.role.delete_all.push(id.toString());
                      case 'team_read':
                      case 'stage_read':
                        access.project.read_all.push(id.toString());
                        access.form.read_all.push(id.toString());
                        access.submission.read_all.push(id.toString());
                        access.role.read_all.push(id.toString());
                        break;
                      case 'team_access':
                        access.project.read_all.push(id.toString());
                    }
                  });
                });
              }

              // Pass the access of this Team to the next function.
              return callback(null);
            });
            /* eslint-enable camelcase, max-statements, no-fallthrough */
          });
        };

        const getPrimaryProjectAdminRole = function(callback) {
          /* eslint-disable camelcase, max-statements, no-fallthrough */
          const getRoles = (project) => {
            formioServer.formio.resources.role.model.find(
              {
                deleted: {$eq: null},
                project: project._id,
              }, function(err, roles) {
                if (err) {
                  return callback(err);
                }

                if (roles && roles.length) {
                  roles.forEach((role) => {
                    if (role.admin) {
                      const roleId = role._id.toString();
                      access.primaryAdminRole = roleId;
                    }
                  });
                }

                return callback(null);
              });
          };
          if (req.userProject && req.userProject.primary) {
           getRoles(req.userProject);
          }
          else if (req.user && req.token) {
            if (!req.projectId) {
              return callback(null);
            }
            const projectId = req.token.project ? req.token.project._id : req.token.form.project;

            formioServer.formio.cache.loadProject(req, projectId, function(err, project) {
              if (err) {
                return callback(err);
              }

              if (project && project.primary) {
                getRoles(project);
              }
              else {
                return callback(null);
              }
            });
          }
          else {
            return callback(null);
          }
          /* eslint-enable camelcase, max-statements, no-fallthrough */
        };

        // Get the permissions for an Project with the given ObjectId.
        handlers.unshift(
          formioServer.formio.plans.checkRequest(req, res),
          getProjectAccess,
          getTeamAccess,
          getPrimaryProjectAdminRole
        );
        handlers.push((callback) => {
          // The groups should be the difference between the user roles and access.roles.
          const groups = (req.user && req.user.roles && access.roles) ? _.difference(req.user.roles, access.roles) : [];

          // Add user teams to the access.
          if (req.user && req.user.teams && req.user.teams.length && formioServer.formio.twoFa.is2FAuthenticated(req)) {
            access.roles = access.roles.concat(req.user.teams);
          }

          // We have some groups that we need to validate.
          if (groups.length) {
            const groupsMap = groups.reduce((result, groupRole) => {
              if (!groupRole) {
                return;
              }
              const [groupId, role = null] = groupRole.toString().split(':');
              return {
                ...result,
                [groupId]: (result[groupId] || []).concat(role),
              };
            }, {});
            const groupIds = _(groupsMap)
              .keys()
              .map(formioServer.formio.util.idToBson)
              .value();

            // Verify these are all submissions within this project.
            formioServer.formio.resources.submission.model
              .find({
                _id: {$in: groupIds},
                project: formioServer.formio.util.idToBson(req.projectId),
                deleted: {$eq: null}
              })
              .lean()
              .select({_id: 1})
              .exec((err, subs) => {
                if (err || !subs || !subs.length) {
                  // Don't add any groups to the access roles.
                  return callback(null);
                }

                // Add the valid groups to the access roles.
                access.roles = access.roles.concat(
                  _(subs)
                    .map((sub) => sub._id.toString())
                    .filter()
                    .flatMap(
                      (groupId) => groupsMap[groupId].map((role) => (role ? `${groupId}:${role}` : groupId)),
                    )
                    .uniq()
                    .value(),
                );
                return callback(null);
              });
          }
          else {
            return callback(null);
          }
        });
        return handlers;
      },

      /**
       * Update the submission resource access query, to include groups the user is a member of, or owns.
       *
       * @param query
       * @param req
       * @param callback
       * @returns {*}
       */
      resourceAccessFilter(query, req, callback) {
        formioServer.formio.plans.getPlan(req, function(err, plan) {
          if (err) {
            return callback(err, []);
          }

          // FOR-209 - Skip group permission checks for non-team/commercial project plans.
          if (['team', 'commercial', 'trial'].indexOf(plan) === -1) {
            return callback(null, []);
          }

          // Return the query and user roles as groups.
          return callback(null, query);
        });
      },

      /**
       * Hook they access entity and perform additional logic.
       *
       * @param entity {Object}
       *   The access entity object.
       * @param req {Object}
       *   The Express request Object.
       *
       * @returns {Object}
       *   The updated access entity object.
       */
      accessEntity(entity, req) {
        if (!entity && req.projectId) {
          // If the entity does not exist, and a projectId is present, then this is a project related access check.
          entity = {
            type: 'project',
            id: req.projectId
          };
        }
        else if (entity && entity.type === 'form') {
          // If this is a create form or index form, use the project as the access entity.
          const createForm = ((req.method === 'POST') && (Boolean(req.formId) === false));
          const indexForm = ((req.method === 'GET') && (Boolean(req.formId) === false));
          if (createForm || indexForm) {
            entity = {
              type: 'project',
              id: req.projectId
            };
          }
        }

        const url = nodeUrl.parse(req.url).pathname.split('/');
        if (
          (url[5] === 'validate') ||
          (url[5] === 'storage' && ['gdrive', 's3', 'dropbox', 'azure'].indexOf(url[6]) !== -1)
        ) {
          entity = {
            type: 'submission',
            id: ''
          };
        }

        return entity;
      },

      /**
       * A secondary access check if router.formio.access.hasAccess fails.
       *
       * @param _hasAccess {Boolean}
       *   If the request has access to perform the given action
       * @param req {Object}
       *   The Express request Object.
       * @param access {Object}
       *   The calculated access object.
       * @param entity {Object}
       *   The access entity object.
       * @param res {Object}
       *   The Express response Object.
       *
       * @returns {Boolean}
       *   If the user has access based on the request.
       */
      /* eslint-disable max-statements */
      hasAccess(_hasAccess, req, access, entity, res) {
        const _url = nodeUrl.parse(req.url).pathname;

        // Allow access if admin.
        if (req.isAdmin) {
          return true;
        }

        /**
         * Check access if the auth token is meant for a remote server.
         */
        if (req.remotePermission) {
          let permission = false;
          switch (req.remotePermission) {
            case 'owner':
            case 'team_admin':
              permission = true;
              break;
            case 'team_write':
              // Allow full access to forms, submissions and roles.
              // TODO: currently projects also control forms so we can't easily restrict here.
              if (['project', 'form', 'submission', 'role', 'action'].indexOf(entity.type) !== -1) {
                permission = true;
              }
              // Only allow get access for projects.
              //if (entity.type === 'project' && req.method === 'GET') {
              //  permission = true;
              //}
              break;
            case 'team_read':
              if ([
                  'form',
                  'submission',
                  'role',
                  'project',
                  'action'
                ].indexOf(entity.type) !== -1 && req.method === 'GET') {
                permission = true;
              }
              break;
            case 'team_access':
              // Only give permission to read the project info.
              if (entity.type === 'project' && req.method === 'GET') {
                permission = true;
              }
          }
          return permission;
        }

        // Check requests not pointed at specific projects.
        if (!entity && !req.projectId) {
          // No project but authenticated.
          if (req.token) {
            if (_url === '/current' || _url === '/logout') {
              return true;
            }
            //Return false if the user doesn't authenticated with 2FA
            if (!formioServer.formio.twoFa.is2FAuthenticated(req)) {
              return false;
            }

            if (req.method === 'POST' && _url === '/project') {
              return req.userProject.primary;
            }

            if (_url === '/project') {
              return true;
            }

            if (_url === '/project/available') {
              return req.userProject.primary;
            }

            if (_url === '/gateway') {
              return req.userProject.primary;
            }

            if (req.method === 'POST' && _url === '/team') {
              return true;
            }

            // This req is unauthorized/unknown.
            if (res) {
              res.sendStatus(404);
            }
            return false;
          }
          // No project but anonymous.
          else {
            // This req is unauthorized.
            return false;
          }
        }

        else if (req.projectId  && _url === `/project/${req.projectId}/spec.json`) {
          return true;
        }

        else if (req.projectId && req.token && formioServer.formio.twoFa.is2FAuthenticated(req) && req.url === `/project/${req.projectId}/report`) {
          return true;
        }

        else if (req.projectId && req.token && req.user && !formioServer.formio.twoFa.is2FAuthenticated(req) && req.url === `/project/${req.projectId}/2fa/authenticate`) {
          return true;
        }

        // Allow access to current tag endpoint.
        else if (req.projectId && req.url === `/project/${req.projectId}/tag/current`) {
          return true;
        }

        else if (req.token && formioServer.formio.twoFa.is2FAuthenticated(req) && access.project && access.project.owner) {
          const url = req.url.split('/');

          // Use submission permissions for access to file signing endpoints.
          if (url[5] === 'storage' && ['s3', 'dropbox', 'azure'].indexOf(url[6]) !== -1) {
            const _access = formioServer.formio.access.hasAccess(req, access, {
              type: 'submission',
              id: req.submissionId
            });
            return _access;
          }

          // This request was made against a project and access was denied, check if the user is the owner.
          if (req.token.user._id === access.project.owner) {
            if (
              (req.method === 'POST' || req.method === 'PUT') &&
              req.body.hasOwnProperty('owner') &&
              req.body.owner
            ) {
              req.assignOwner = true;
            }

            // Allow the project owner to have access to everything.
            return true;
          }
        }

        // Access was not explicitly granted, therefore it was denied.
        return false;
      },
      /* eslint-enable max-statements */

      /**
       * Hook the PermissionSchema.
       *
       * @param schema {Object}
       *   The Permission schema.
       *
       * @return {Object}
       *   The updated permission schema.
       */
      permissionSchema(schema) {
        // Allow for permission to be provided for group self access.
        schema.permission = {
          type: String,
          enum: [
            'admin',
            'read',
            'write'
          ]
        };

        schema.type.enum.push(
          'group',
          'team_access',
          'team_read',
          'team_write',
          'team_admin',
          'stage_read',
          'stage_write'
        );
        return schema;
      },

      importActionQuery(query, action, template) {
        if (query.hasOwnProperty('$or')) {
          query.$or.forEach(subQuery => {
            subQuery.form = formioServer.formio.util.idToBson(action.form);
          });
        }
        else {
          query.form = formioServer.formio.util.idToBson(action.form);
        }
        return query;
      },

      importFormQuery(query, form, template) {
        if (query.hasOwnProperty('$or')) {
          query.$or.forEach(subQuery => {
            subQuery.project = formioServer.formio.util.idToBson(form.project);
          });
        }
        else {
          query.project = formioServer.formio.util.idToBson(form.project);
        }
        return query;
      },

      importRoleQuery(query, role, template) {
        if (query.hasOwnProperty('$or')) {
          query.$or.forEach(subQuery => {
            subQuery.project = formioServer.formio.util.idToBson(role.project);
          });
        }
        else {
          query.project = formioServer.formio.util.idToBson(role.project);
        }
        return query;
      },

      defaultTemplate(template, options) {
        template.access = options.access;
        return template;
      },

      templateAlters(alters) {
        alters.role = (item, template, done) => {
          item.project = template._id;
          this.roleMachineName(item.machineName, item, (err, machineName) => {
            if (err) {
              return done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        };

        const createFormRevision = (item, doc, {_vid, tag}, done) => {
          formioServer.formio.resources.form.model.findOneAndUpdate({
            _id: doc._id
          },
          {$set: {_vid: _vid}})
          .then((result)=> {
            const body = Object.assign({}, item);
            body._rid = result._id;
            body._vid = result._vid;
            body._vuser = 'system';
            body._vnote = `Deploy version tag ${tag}`;
            delete body._id;
            delete body.__v;

            formioServer.formio.mongoose.models.formrevision.create(body, () => {
              done(null, item);
            });
          })
          .catch(err => {
            if (err) {
              return done(err);
            }
          });
        };

        alters.form = (item, template, done) => {
          item.project = template._id;
          this.formMachineName(item.machineName, item, (err, machineName) => {
            if (err) {
              return done(err);
            }

            item.machineName = machineName;

            formioServer.formio.resources.form.model.findOne({
              machineName: item.machineName,
              deleted: {$eq: null},
              project: formioServer.formio.util.idToBson(item.project)
            }).exec((err, doc) => {
              if (err) {
                return done(err);
              }
              // If form doesn't exist or revisions are disabled, don't worry about revisions.
              if (!doc || !doc.revisions) {
                return done(null, item);
              }

              // If form isn't changing.
              if (_.isEqual(item.components, doc.components.toObject())) {
                return done(null, item);
              }

              createFormRevision(item, doc, {
                _vid: parseInt(doc._vid) + 1,
                tag: template.tag,
              }, done);
            });
          });
        };

        const getFormRevisions = (item, done) => {
          formioServer.formio.resources.form.model.findOne({
            machineName: item.machineName,
            deleted: {$eq: null},
            project: formioServer.formio.util.idToBson(item.project),
          }).exec((err, form) => {
            if (err) {
              return done(err);
            }

            if (!form || form._vid || !form.revisions) {
              return done(null, form);
            }

            formioServer.formio.resources.formrevision.model.findOne({
              _rid: form._id,
            }).exec((err, formrevision) => {
              if (err) {
                return done(err);
              }

              return done(null, form, formrevision);
            });
          });
        };

        alters.formSave = (item, done) => {
          getFormRevisions(item, (err, form, formrevision) => {
            if (err) {
              return done(err);
            }
            // If there is no form or formrevision already exists then skip it
            if (!form || form._vid || !form.revisions || formrevision) {
              return done(null, item);
            }

            createFormRevision(item, form, {
              _vid: parseInt(form._vid) + 1,
              tag: '',
            }, done);
          });
        };

        alters.action = (item, template, done) => {
          item.project = template._id;
          this.actionMachineName(item.machineName, item, (err, machineName) => {
            if (err) {
              return done(err);
            }

            const parts = machineName.split(':');
            const formName = parts.length === 1 ? parts[0] : parts[1];

            const formExists = (template.forms && template.forms[formName])
              || (template.resources && template.resources[formName]);

            if (!formExists) {
              return done(null, null);
            }

            item.machineName = machineName;
            done(null, item);
          });
        };

        return alters;
      },

      templateImportSteps: (steps, install, template) => {
        const projectEntity = {
          createOnly: !template.primary,
          model: formioServer.formio.resources.project.model,
          valid: entity => {
            const project = entity[template.machineName || template.name || 'project'];
            if (!project || !project.title) {
              return false;
            }

            return true;
          },
          cleanUp: (template, items, done) => {
            template._id = items[template.machineName || template.name]._id;

            return done();
          }
        };

        const project = {};
        const projectKeys = ['title', 'name', 'tag', 'description', 'machineName'];
        project[template.machineName || template.name || 'export'] = _.pick(template, projectKeys);
        project[template.machineName || template.name || 'export'].primary = !!template.isPrimary;
        steps.unshift(async.apply(install(projectEntity), template, project));

        // TODO: this may be better in the project entity's transform() method so we can install project entity in one fell swoop
        const _importAccess = (template, items, done) => {
          formioServer.formio.cache.loadCache.load(template._id, (err, project) => {
            if (err) {
              return done(err);
            }

            if (!project) {
              return done();
            }

            // Set the project access if it doesn't exist or isn't already an array.
            if (!project.access || !Array.isArray(project.access)) {
              project.access = [];
            }

            if ('access' in template && Array.isArray(template.access)) {
              template.access.forEach(access => {
                if (access && Array.isArray(access.roles)) {
                  const projectAccess = _.find(project.access, {type: access.type});
                  const newRoles = _.filter(_.map(access.roles, name => {
                    if (template.roles && template.roles.hasOwnProperty(name)) {
                      return template.roles[name]._id;
                    }
                    return false;
                  }));
                  if (projectAccess && Array.isArray(projectAccess.roles)) {
                    projectAccess.roles = _.uniq(newRoles);
                  }
                  else {
                    project.access.push({
                      type: access.type,
                      roles: newRoles
                    });
                  }
                }
              });

              // Ensure we have unique access.
              if (project.access && Array.isArray(project.access)) {
                project.access = _.uniqBy(project.access, 'type');
              }
            }
            else if (
              (!('excludeAccess' in template) || !template.excludeAccess) &&
              'roles' in template &&
              Object.keys(template.roles).length > 0 &&
              'administrator' in template.roles
            ) {
              // Add all roles to read_all.
              const readAllRoles = [];
              Object.keys(template.roles).forEach(roleName => {
                readAllRoles.push(template.roles[roleName]._id);
              });

              project.access = [
                {
                  type: 'create_all',
                  roles: [
                    template.roles.administrator._id
                  ]
                },
                {
                  type: 'read_all',
                  roles: readAllRoles
                },
                {
                  type: 'update_all',
                  roles: [
                    template.roles.administrator._id
                  ]
                },
                {
                  type: 'delete_all',
                  roles: [
                    template.roles.administrator._id
                  ]
                }
              ];
            }

            // Update this project.
            formioServer.formio.cache.updateProject(project._id, {
              access: project.access
            }, done);
          });
        };

        steps.push(async.apply(_importAccess, template, project));
        return steps;
      },

      templateExportSteps: (steps, template, map, options) => {
        const _exportAccess = function(_export, _map, options, next) {
          // Clean up roles to point to machine names.
          const accesses = _.cloneDeep(_export.access);
          _export.access = [];
          _.each(accesses, function(access) {
            if (access.type.indexOf('team_') === -1) {
              const roleNames = _.map(access.roles, roleId => _map.roles[roleId.toString()]);
              _export.access.push({
                type: access.type,
                roles: roleNames
              });
            }
          });
          delete template.projectId;
          delete template._id;

          next();
        };

        steps.push(async.apply(_exportAccess, template, map, options));
        return steps;
      },

      exportOptions(options, req, res) {
        const currentProject = formioServer.formio.cache.currentProject(req);
        options.title = currentProject.title;
        options.tag = currentProject.tag;
        options.name = currentProject.name;
        options.description = currentProject.description;
        options.projectId = currentProject._id.toString() || req.projectId || req.params.projectId || 0;
        options.access = currentProject.access;

        return options;
      },

      importOptions(options, req, res) {
        const currentProject = formioServer.formio.cache.currentProject(req);
        if (!(options instanceof Object)) {
          options = {};
        }
        options._id = currentProject._id;
        options.name = currentProject.name;
        options.machineName = currentProject.machineName;
        return options;
      },

      requestParams(req, params) {
        let projectId = params.project;
        if (projectId && projectId === 'available') {
          projectId = null;
        }
        req.projectId = projectId;
        return params;
      },

      /**
       * Hook the user object and modify the roles to include the users team id's.
       *
       * @param user {Object}
       *   The current user object to modify.
       * @param next {Function}
       *   The callback function to invoke with the modified user object.
       */
      user(user, next) {
        if (!user) {
          return next();
        }

        // Force the user reference to be an object rather than a mongoose document.
        try {
          user = user.toObject();
          user._id = user._id.toString();
        }
        catch (e) {
          //debug.error(e);
        }

        user = user || {};
        user.roles = user.roles || [];
        user.teams = user.teams || [];

        // Convert all the roles to strings
        user.roles = _(user.roles)
          .filter()
          .map(formioServer.formio.util.idToString)
          .uniq()
          .value();

        formioServer.formio.teams.getTeams(user, false, true)
          .then((teams) => {
            if (!teams || !teams.length) {
              return next(null, user);
            }

            // Filter the teams to only contain the team ids.
            user.teams = _(teams)
              .map('_id')
              .filter()
              .map(formioServer.formio.util.idToString)
              .value();

            next(null, user);
          }).catch((err) => {
            next(err);
          });
      },

      /**
       * Allow a user with the correct jwt secret, to skip user loading and supply their own permissions check.
       *
       * @param decoded
       * @param req
       * @returns {boolean}
       */
      external(decoded, req) {
        // Get the projectId from the remote token.
        const projectId = decoded.project ? decoded.project._id : (decoded.form ? decoded.form.project : null);

        // Don't allow token parsing for hosted version.
        if (
          !config.formio.hosted &&
          req.currentProject &&
          (req.currentProject._id.toString() === projectId) &&
          req.currentProject.settings &&
          req.currentProject.settings.tokenParse
        ) {
          try {
            const data = evaluateSync({
              deps: ['lodash'],
              code: req.currentProject.settings.tokenParse,
              data: {
                token: decoded,
                roles: req.currentProject.roles
              },
              timeout: config.formio.vmTimeout
            });
            if (!data.hasOwnProperty('user')) {
              throw new Error('User not defined on data.');
            }
            if (typeof data.user !== 'object') {
              throw new Error('User not an object.');
            }
            if (!data.user.hasOwnProperty('_id')) {
              throw new Error('_id not defined on user.');
            }
            if (typeof data.user._id !== 'string') {
              throw new Error('_id not a string.');
            }
            if (!data.user.hasOwnProperty('roles')) {
              throw new Error('roles not defined on user.');
            }
            if (!Array.isArray(data.user.roles)) {
              throw new Error('roles not an array.');
            }

            // Make sure assigned role ids are actually in the project.
            const roleIds = _.map(req.currentProject.roles, role => role._id.toString());
            data.user.roles.forEach(roleId => {
              if (!roleIds.includes(roleId)) {
                throw new Error('Invalid role id. Not in project.');
              }
            });

            req.token = data;
            req.user = data.user;
            return false;
          }
          catch (err) {
            // eslint-disable-next-line no-console
            debug('Error parsing JWT token: ', err.message || err);
            console.error('Error parsing JWT token:', err.message || err);
          }
        }

        // If external is provided in the signed token, use the decoded token as the request token.
        // Only allow external tokens for the projects they originated in.
        if (
          decoded.external === true &&
          (!config.formio.hosted || (req.projectId && req.projectId === projectId))
        ) {
          req.token = decoded;
          req.user = decoded.user;
          return false;
        }

        return true;
      },

      /**
       * Hook a form query and add the requested projects information.
       *
       * @param query {Object}
       *   The Mongoose query to be performed.
       * @param req {Object}
       *   The Express request.
       * @param formio {Boolean}
       *   Whether or not the query is being used against the formio project.
       *
       * @returns {Object}
       *   The modified mongoose request object.
       */
      formQuery(query, req, formio) {
        // Determine which project to use, one in the request, or formio.
        if (formio && formio === true) {
          return formioServer.formio.cache.loadProjectByName(req, 'formio', function(err, _id) {
            if (err || !_id) {
              return query;
            }

            query.project = formioServer.formio.util.idToBson(_id);
            return query;
          });
        }
        else {
          req.projectId = req.projectId || (req.params ? req.params.projectId : undefined) || req._id;
          query.project = formioServer.formio.util.idToBson(req.projectId);
          return query;
        }
      },

      /**
       * Hook for submission queries to add the project id into the query.
       *
       * @param query
       * @param req
       * @return {*}
       */
      submissionQuery(query, req) {
        // Allow targetted submissions queries to go through.
        if (query._id && !query._id.$in) {
          return query;
        }

        req.projectId = req.projectId || (req.params ? req.params.projectId : undefined) || req._id;
        if (req.projectId) {
          query.project = formioServer.formio.util.idToBson(req.projectId);
        }
        return query;
      },

      actionsQuery(query, req) {
        // Allow only for server to server communication.
        if (!req.isAdmin) {
          return query;
        }

        // Included actions take privilege over excluded.
        const includedActions = formioServer.formio.util.getHeader(req, 'x-actions-include');
        const excludedActions = formioServer.formio.util.getHeader(req, 'x-actions-exclude');

        const actionsToProcess = includedActions || excludedActions;
        if (actionsToProcess) {
          const {
            ids,
            names,
          } = actionsToProcess.split(',').reduce(
            ({
              ids,
              names,
            }, action) => {
              const id = formioServer.formio.util.idToBson(action);
              return _.isObject(id)
                ? ({
                  ids: [...ids, id],
                  names,
                })
                : ({
                  ids,
                  names: [...names, action],
                });
            },
            {
              ids: [],
              names: [],
            },
          );

          if (ids.length !== 0 || names.length !== 0) {
            const expressions = [];
            const logicalOperator = includedActions ? '$or' : '$and';
            const comparisonOperator = includedActions ? '$in' : '$nin';

            if (ids.length !== 0) {
              expressions.push({
                _id: {
                  [comparisonOperator]: ids,
                },
              });
            }

            if (names.length !== 0) {
              expressions.push({
                name: {
                  [comparisonOperator]: names,
                },
              });
            }

            if (expressions.length) {
              query[logicalOperator] = expressions;
            }
          }
        }

        return query;
      },

      formSearch(search, model, value) {
        search.project = model.project;
        return search;
      },
      cacheInit(cache) {
        cache.projects = {};
        return cache;
      },
      postSubmissionUpdate(req, res, update) {
        if (req.currentForm) {
          // Check for group self access and add the id if available.
          const groupPerms = _.find(req.currentForm.submissionAccess, {
            type: 'group'
          });
          if (groupPerms) {
            const existingAccess = _.find(res.resource.item.access, {
              type: groupPerms.permission
            });
            if (existingAccess) {
              existingAccess.resouces = existingAccess.resouces || [];
              existingAccess.resouces.push(res.resource.item._id.toString());
            }
            else {
              res.resource.item.access = res.resource.item.access || [];
              res.resource.item.access.push({
                type: groupPerms.permission,
                resources: [res.resource.item._id.toString()]
              });
            }

            // Set the update.
            update.access = res.resource.item.access;
          }
        }
        return update;
      },
      submission(req, res, next) {
        if (req.body.hasOwnProperty('_fvid') && typeof res.submission === 'object') {
          res.submission._fvid = req.body._fvid;
        }
        try {
          encrypt.handle(req, res, next);
        }
        catch (err) {
          return next(err);
        }
      },
      submissionParams(params) {
        params.push('oauth', '_fvid', 'state');
        return params;
      },
      submissionRequestQuery(query, req) {
        query.projectId = req.projectId;
        return query;
      },
      submissionRequestTokenQuery: function(query, token) {
        if (token.project) {
          query.projectId = token.project._id;
        }
        else if (token.form.project) {
          query.projectId = token.form.project;
        }
        else {
          query.projectId = formioServer.formio.mongoose.Types.ObjectId('000000000000000000000000');
        }
        return query;
      },
      getSubmissionModel: require('../util/util').getSubmissionModel,
      getSubmissionRevisionModel: require('../util/util').getSubmissionRevisionModel,
      formRoutes: require('./alter/formRoutes')(app),
      submissionRoutes: require('./alter/submissionRoutes')(app),
      worker: require('./alter/worker')(app),
      transformReferences: require('./alter/transformReferences')(app),

      actionRoutes(routes) {
        routes.beforePost = routes.beforePost || [];
        routes.beforePut = routes.beforePut || [];
        routes.beforeDelete = routes.beforeDelete || [];
        routes.afterPost = routes.afterPost || [];
        routes.afterPut = routes.afterPut || [];
        routes.afterDelete = routes.afterDelete || [];

        const projectProtectAccess = require('../middleware/projectProtectAccess')(formioServer.formio);
        const projectModified= require('../middleware/projectModified')(formioServer.formio);

        _.each(['beforePost', 'beforePut', 'beforeDelete'], handler => {
          routes[handler].unshift(projectProtectAccess);
        });

        _.each(['afterPost', 'afterPut', 'afterDelete'], handler => {
          routes[handler].push(projectModified);
        });

        return routes;
      },

      roleRoutes(routes) {
        routes.before.unshift(require('../middleware/bootstrapEntityProject'), require('../middleware/projectFilter'));
        routes.before.unshift(require('../middleware/projectProtectAccess')(formioServer.formio));
        routes.after.push(require('../middleware/projectModified')(formioServer.formio));
        return routes;
      },
      submissionSchema(schema) {
        // Defines what each external Token should be.
        const ExternalTokenSchema = formioServer.formio.mongoose.Schema({
          type: String,
          token: String,
          exp: Date
        });
        schema.externalTokens = [ExternalTokenSchema];
        return schema;
      },
      newRoleAccess(handlers, req) {
        const projectId = req.projectId;

        /**
         * Async function to add the new role to the read_all access of the project.
         *
         * @param done
         */
        const updateProject = function(_role, done, req, id, cb) {
          formioServer.formio.cache.loadCache.load(projectId, (err, project) => {
            if (err) {
              return done(err);
            }
            if (!project) {
              return done();
            }

            // Add the new roleId to the access list for read_all (project).
            project.access = project.access || [];
            let found = false;
            for (let a = 0; a < project.access.length; a++) {
              if (project.access[a].type === 'read_all') {
                project.access[a].roles = project.access[a].roles || [];
                project.access[a].roles.push(_role);
                project.access[a].roles = _.uniq(project.access[a].roles);
                found = true;
              }
            }

            // The read_all permission type was not previously added.
            if (!found) {
              project.access.push({
                type: 'read_all',
                roles: [_role]
              });
            }

            // Save the updated permissions.
            formioServer.formio.cache.updateProject(projectId, {
              access: project.access
            }, (err) => {
              if (err) {
                return done(err);
              }
              done();
            });
          });
        };

        // Update the project when new roles are added.
        handlers.unshift(updateProject);
        return handlers;
      },
      roleQuery(query, req) {
        const projectId = req.projectId || (req.params ? req.params.projectId : undefined) || req._id
        || _.get(req, 'token.project._id') || _.get(req, 'token.form.project');
        query.project = formioServer.formio.util.idToBson(projectId);
        return query;
      },
      roleSearch(search, model, value) {
        return this.formSearch(search, model, value);
      },
      roleSchema(schema) {
        schema.add({
          project: {
            type: formioServer.formio.mongoose.Schema.Types.ObjectId,
            ref: 'project',
            index: true,
            required: true
          }
        });
        return schema;
      },
      actionItem(actionItem, req) {
        actionItem.project = req.projectId;
        return actionItem;
      },
      formMachineName(machineName, document, done) {
        if (!document) {
          return done(null, machineName);
        }
        formioServer.formio.cache.loadCache.load(document.project, function(err, project) {
            if (err) {
              return done(err);
            }
            if (!project) {
              return done(null, machineName);
            }

            if (!project) {
              return done(null, `${document.project}:${machineName}`);
            }

            done(null, `${project.machineName}:${machineName}`);
          });
      },
      roleMachineName(machineName, document, done) {
        this.formMachineName(machineName, document, done);
      },
      actionMachineName(machineName, document, done) {
        if (!document) {
          return this.formMachineName(machineName, null, done);
        }
        formioServer.formio.resources.form.model.findOne({_id: document.form, deleted: {$eq: null}})
          .lean()
          .exec((err, form) => {
            if (err) {
              return done(err);
            }

            this.formMachineName(machineName, form, done);
          });
      },
      machineNameExport(machineName) {
        if (!machineName) {
          return 'export';
        }

        const parts = machineName.split(':');
        if (parts.length === 1) {
          return parts.pop();
        }

        // Remove the project portion of the machine name.
        parts.shift();

        // Rejoin the machine name as : seperated.
        return parts.join(':');
      },
      exportComponent(component) {
        if (component.type === 'resource') {
          component.project = 'project';
        }
      },
      importComponent(template, component) {
        if (!component) {
          return false;
        }
        if (component.hasOwnProperty('project')) {
          if (template._id) {
            component.project = template._id.toString();
            return true;
          }
        }
        return false;
      },

      /**
       * A hook to expose the current formio config for the update system.
       *
       * @param {Object} config
       *   The current formio core config.
       */
      updateConfig(config) {
        // Hook the schema let to load the latest public/private schema.
        const pkg = JSON.parse(fs.readFileSync('./package.json'));
        if (pkg && pkg.schema && pkg.schema !== null && semver.gt(pkg.schema, config.schema)) {
          config.schema = pkg.schema;
        }

        return config;
      },

      /**
       * A hook to expose the update system on system load.
       *
       * @param files {Array}
       *   The publicly available updates.
       * @param next {Function}
       *   The next function to invoke after altering the file list.
       */
      getUpdates(files, next) {
        files = files || [];

        let _files = require('../db/updates/index.js');
        _files = Object.keys(_files);
        // Add the private updates to the original file list and continue.
        files = files.concat(_files);
        next(null, files);
      },

      /**
       * A hook to expose the update system on system load.
       *
       * @param configFormsUpdates {Object}
       *   The publicly available updates.
       */
      getConfigFormsUpdates(configFormsUpdates) {
        if (!_.isPlainObject(configFormsUpdates)) {
          configFormsUpdates = {};
        }

        const _files = require('../db/configFormsUpdates/index.js');
        _.assign(configFormsUpdates, _files || {});

        return configFormsUpdates;
      },

      /**
       * A hook to expose the update file paths.
       *
       * @param name {String}
       *   The
       */
      updateLocation(name) {
        let update = null;

        try {
          // Attempt to resolve the private update.
          const _files = require('../db/updates/index.js');
          if (_files.hasOwnProperty(name)) {
            update = _files[name];
          }
        }
        catch (e) {
          update = null;
        }

        return update;
      },

       /**
       * A hook to check permissions to send emails from the form.io domain.
       *
       * @param mail {Object}
       *   The mail object.
       * @param form {Object}
       *   The form object.
       * @return {Promise}
       */
      checkEmailPermission(mail, form) {
        return new Promise((resolve, reject) => {
          let isAllowed = !(mail.from || '').match(/form\.io/gi);
          if (!isAllowed) {
            // form.io to form.io emails are allowed.
            isAllowed = !!(mail.to || '').match(/form\.io/gi);
          }
          if (!isAllowed) {
            const ownerId = _.get(form, 'owner', '');
            if (!ownerId) {
              return reject('You are not allowed to send a message from the form.io domain');
            }
            const submissionModel = formioServer.formio.resources.submission.model;

            submissionModel.findOne({_id: ownerId.toString()}, (err, owner) => {
              if (err) {
                return reject(err);
              }

              const email = _.get(owner, 'data.email');

              isAllowed = !!email && email.match(/form\.io/gi);

              if (isAllowed) {
                resolve(mail);
              }
              else {
                reject('You are not allowed to send a message from the form.io domain');
              }
            });
          }
          else {
            resolve(mail);
          }
        });
      },

       /**
       * A hook to set Access-Control-Expose-Headers.
       *
       * @param headers {String}
       * @return {String}
       */
      accessControlExposeHeaders(headers) {
        if (formioServer.config.enableOauthM2M && headers && typeof headers === 'string') {
          headers += ', x-m2m-token';
        }

        return headers;
      },

      /**
       * Check if the user authenticated with 2FA. If not, returns null.
       *
       * @param user
       * @param req
       * @returns {*}
       */
      twoFAuthenticatedUser(user, req) {
        if (user && !formioServer.formio.twoFa.is2FAuthenticated(req)) {
          return null;
        }

        return user;
      },

      /**
       * Check if the user authenticated with 2FA. If not, returns an array with the default Role.
       *
       * @param roles
       * @param defaultRole
       * @param req
       * @returns [Strilg]
       */
      userRoles(roles, defaultRole, req) {
        if (!formioServer.formio.twoFa.is2FAuthenticated(req)) {
          return [defaultRole];
        }

        return roles;
      },

      /**
       * Check if the user authenticated with 2FA for Login Action.
       *
       * @param req
       * @param res
       * @returns {*}
       */
      currentUserLoginAction(req, res) {
        const status = _.get(res,'resource.status', null);
        if (!formioServer.formio.twoFa.is2FAuthenticated(req) && status === 200) {
          _.set(res, 'resource.item', {
            isTwoFactorAuthenticationRequired: true,
          });
        }
      },

       /**
       * A hook to get a m2m oAuth token.
       *
      * @param req {Object}
       *   The Express request Object.
       * @param res {Object}
       *   The Express response Object.
       * @param next {Function}
       *   The callback function.
       */
      oAuthResponse(req, res, cb) {
        if (!formioServer.config.enableOauthM2M || !req.user || req.path.indexOf('logout') !== -1) {
          return cb();
        }

        const m2m = _.get(req.userProject || req.currentProject || {}, 'settings.oauth.oauthM2M');

        if (m2m) {
          const m2mToken = _.get(req.token, 'm2mToken');

          if (m2mToken && m2mToken.expires_at && moment.utc().isBefore(m2mToken.expires_at)) {
            res.setHeader('x-m2m-token', m2mToken.access_token);

            return cb();
          }

          const {
            clientId,
            clientSecret,
            tokenURI
          } = m2m;

          if (!clientId || !clientSecret || !tokenURI) {
            return cb();
          }

          const url = new URL(tokenURI);
          const tokenHost = url.origin;
          const tokenPath = url.pathname;
          let provider = new ClientCredentials({
            client: {
              id: clientId,
              secret: clientSecret,
            },
            auth: {
              tokenHost,
              tokenPath,
            }
          });

          return provider.getToken()
            .then(accessToken => accessToken.token)
            .then((token) => {
              if (!token) {
                throw 'No response from OAuth Provider.';
              }
              if (token.error) {
                throw token.error_description;
              }

              req.token = {
                ...req.token,
                m2mToken: {...token},
              };

              res.token = formioServer.formio.auth.getToken(req.token);
              req['x-jwt-token'] = res.token;

              if (!res.headersSent) {
                const headers = this.accessControlExposeHeaders('x-jwt-token');
                res.setHeader('Access-Control-Expose-Headers', headers);
                res.setHeader('x-m2m-token', token.access_token);
              }
              provider = null;
              cb();
            })
            .catch((err) => {
              app.formio.formio.log('M2M Token error', err);
              cb();
            });
        }
        else {
          return cb();
        }
      },

      getPrimaryProjectAdminRole(req, res, cb) {
        /* eslint-disable camelcase, max-statements, no-fallthrough */
        const getRoles = (project) => {
          formioServer.formio.resources.role.model.find(
            {
              deleted: {$eq: null},
              project: project._id,
            }, function(err, roles) {
              if (err) {
                return cb(err);
              }

              let primaryAdminRole;

              if (roles && roles.length) {
                roles.forEach((role) => {
                  if (role.admin) {
                    const roleId = role._id.toString();
                    primaryAdminRole = roleId;
                  }
                });
              }

              cb(null, primaryAdminRole);
            });
        };

        if (req.userProject && req.userProject.primary) {
         getRoles(req.userProject);
        }
        else if (req.user && req.token) {
          const projectId = req.token.project ? req.token.project._id : req.token.form.project;
          formioServer.formio.cache.loadProject(req, projectId, function(err, project) {
            if (err) {
              return cb(err);
            }

            if (project && project.primary) {
              getRoles(project);
            }
            else {
              return cb(null);
            }
          });
        }
        else {
          return cb(null);
        }
        /* eslint-enable camelcase, max-statements, no-fallthrough */
      },

      formRevisionModel() {
        return formioServer.formio.mongoose.models.formrevision;
      },

      includeReports() {
        return !config.formio.hosted && _.get(app, 'license.terms.options.reporting', false);
      },

      checkEncryption(formio, db) {
        if (formio.config.mongoSecretOld && formio.config.mongoSecret) {
          updateSecret(formio, db, formio.config.mongoSecret, formio.config.mongoSecretOld);
        }
      }
    }
  };
};
