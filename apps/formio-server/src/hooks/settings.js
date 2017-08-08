'use strict';

var _ = require('lodash');
var debug = {
  settings: require('debug')('formio:settings'),
  error: require('debug')('formio:error'),
  import: require('debug')('formio:project:import')
};
var o365Util = require('../actions/office365/util');
var kickboxValidate = require('../actions/kickbox/validate');
var nodeUrl = require('url');
var jwt = require('jsonwebtoken');
var semver = require('semver');
var util = require('../util/util');
let async = require('async');
var chance = new (require('chance'))();
var fs = require('fs');

module.exports = function(app) {
  var formioServer = app.formio;

  // Include the request cache.
  var cache = require('../cache/cache')(formioServer.formio);

  // Attach the project plans to the formioServer
  formioServer.formio.plans = require('../plans/index')(formioServer, cache);

  // Attach the teams to formioServer.
  formioServer.formio.teams = require('../teams/index')(app, formioServer);

  // Mount the analytics API.
  formioServer.analytics.endpoints(app, formioServer);

  // Handle Payeezy form signing requests and project upgrades
  app.formio.formio.payment = require('../payment/payment')(app, app.formio.formio);

  return {
    settings: function(settings, req, cb) {
      if (!req.projectId) {
        if (settings !== undefined) {
          return cb(null, settings);
        }

        return cb('No project ID provided.');
      }

      // Load the project settings.
      cache.loadProject(req, req.projectId, function(err, project) {
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
      init: function(type, formio) {
        switch (type) {
          case 'alias':
            // Dynamically set the baseUrl.
            formio.middleware.alias.baseUrl = function(req) {
              return '/project/' + req.projectId;
            };

            // Add the alias handler.
            app.use(formio.middleware.alias);
            return true;
          case 'params':
            app.use(formio.middleware.params);
            return true;
          case 'token':
            app.use(require('../middleware/remoteToken')(app));
            app.use(formio.middleware.tokenHandler);
            app.use(require('../middleware/userProject')(cache));
            return true;
          case 'logout':
            app.get('/logout', formio.auth.logout);
            return false;
          case 'getTempToken':
            app.get('/token', formio.auth.tempToken);
            return false;
          case 'current':
            app.get('/current', formio.auth.currentUser);
            return false;
          case 'access':
            app.get('/access', formio.middleware.accessHandler);
            return false;
          case 'perms':
            app.use(formio.middleware.permissionHandler);
            return true;
        }

        return false;
      },
      formRequest: function(req, res) {
        // Make sure to always include the projectId in POST and PUT calls.
        if (req.method === 'PUT' || req.method === 'POST') {
          req.body.project = req.projectId || req.params.projectId;
        }
      },
      validateEmail: function(component, path, req, res, next) {
        if (
          (component.type === 'email') &&
          component.kickbox &&
          component.kickbox.enabled
        ) {
          // Load the project settings.
          cache.loadProject(req, req.projectId, function(err, project) {
            if (err) {
              return next(err);
            }
            if (!project) {
              return res.status(400).send('Could not find project');
            }

            // Validate with kickbox.
            kickboxValidate(project, component, path, req, res, next);
          });

          // Return true so that we can handle this request.
          return true;
        }

        // Return false to move on with the request.
        return false;
      },
      email: function(transport, settings, projectSettings, req, res, params) {
        var transporter = {};
        if ((transport === 'outlook') && projectSettings.office365.email) {
          transporter.sendMail = function(mail) {
            o365Util.request(formioServer, req, res, 'sendmail', 'Office365Mail', 'application', {
              Message: {
                Subject: mail.subject,
                Body: o365Util.getBodyObject(mail.html),
                ToRecipients: o365Util.getRecipientsObject(_.map(mail.to.split(','), _.trim)),
                From: o365Util.getRecipient(projectSettings.office365.email)
              }
            });
          };
        }
        return transporter;
      }
    },
    alter: {
      formio: function(app) {
        if (app.formio && app.formio.formio) {
          return app.formio.formio;
        }
        else if (app.formio) {
          return app.formio;
        }

        return app;
      },
      resources: function(resources) {
        return _.assign(resources, require('../resources/resources')(app, formioServer));
      },
      models: function(models) {
        // Add the project to the form schema.
        models.form.schema.add({
          project: {
            type: formioServer.formio.mongoose.Schema.Types.ObjectId,
            ref: 'project',
            index: true,
            required: true
          }
        });

        // Add additional models.
        return _.assign(models, require('../models/models')(formioServer));
      },
      email: function(mail, req, res, params, cb) {
        let _debug = require('debug')('formio:hook:email');
        _debug(mail);
        if (mail.to.indexOf(',') !== -1) {
          return cb(null, mail);
        }

        // Find the ssoToken.
        var ssoToken = util.ssoToken(mail.html);
        if (!ssoToken) {
          _debug(`No ssoToken`);
          return cb(null, mail);
        }

        var query = formioServer.formio.hook.alter('formQuery', {
          name: {'$in': ssoToken.resources},
          deleted: {$eq: null}
        }, req);

        // Find the forms to search the record within.
        _debug(query);
        formioServer.formio.resources.form.model.find(query).exec(function(err, result) {
          if (err || !result) {
            _debug(err || `No form was found`);
            return cb(err, mail);
          }

          var forms = [];
          var formObjs = {};
          result.forEach(function(form) {
            formObjs[form._id.toString()] = form;
            forms.push(form._id);
          });

          var query = {
            form: {'$in': forms},
            deleted: {$eq: null}
          };

          // Set the username field to the email address this is getting sent to.
          query[ssoToken.field] = {$regex: new RegExp('^' + formioServer.formio.util.escapeRegExp(mail.to) + '$'), $options: 'i'};

          // Find the submission.
          _debug(query);
          formioServer.formio.resources.submission.model
            .findOne(query)
            .select('_id, form')
            .exec(function(err, submission) {
              if (err || !submission) {
                _debug(err || `No submission found`);
                return cb(null, mail);
              }

              // Create a new JWT token for the SSO.
              var token = formioServer.formio.hook.alter('token', {
                user: {
                  _id: submission._id.toString()
                },
                form: {
                  _id: submission.form.toString()
                }
              }, formObjs[submission.form.toString()]);

              // Create a token that expires in 30 minutes.
              token = jwt.sign(token, formioServer.formio.config.jwt.secret, {
                expiresIn: ssoToken.expireTime * 60
              });

              // Replace the string token with the one generated here.
              mail.html = mail.html.replace(util.tokenRegex, token);

              // TO-DO: Generate the token for this user.
              _debug(mail);
              return cb(null, mail);
            });
        }.bind(this));
      },
      actions: function(actions) {
        actions.office365contact = require('../actions/office365/Office365Contact')(formioServer);
        actions.office365calendar = require('../actions/office365/Office365Calendar')(formioServer);
        actions.hubspotContact = require('../actions/hubspot/hubspotContact')(formioServer);
        actions.oauth = require('../actions/oauth/OAuthAction')(formioServer);
        actions.googlesheet = require('../actions/googlesheet/googleSheet')(formioServer);
        actions.sqlconnector = require('../actions/sqlconnector/SQLConnector')(formioServer);
        actions.jira = require('../actions/atlassian/jira')(formioServer);
        actions.group = require('../actions/GroupAction')(formioServer);
        actions.moxtraLogin = require('../actions/moxtra/MoxtraLogin')(formioServer);
        actions.moxtraMessage = require('../actions/moxtra/MoxtraMessage')(formioServer);
        actions.moxtraTodo = require('../actions/moxtra/MoxtraTodo')(formioServer);
        return actions;
      },

      /**
       * Alter specific actions to be flagged as premium actions.
       *
       * @param title
       */
      actionInfo: function(action) {
        // Modify premium actions if present.
        var premium = [
          'webhook', 'oauth', 'office365contact', 'office365calendar', 'hubspotContact', 'googlesheet', 'jira'
        ];
        if (action.title && action.name && !action.premium && premium.indexOf(action.name) !== -1) {
          action.title += ' (Premium)';
          action.premium = true;
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
      resolve: function(defaultReturn, action, handler, method, req, res) {
        if (process.env.DISABLE_RESTRICTIONS) {
          return true;
        }
        var _debug = require('debug')('formio:settings:resolve');
        var premium = [
          'webhook', 'oauth', 'office365contact', 'office365calendar', 'hubspotContact', 'googlesheet', 'jira'
        ];

        // If the action does not have a name, or is not flagged as being premium, ignore it.
        if (!action.hasOwnProperty('name')) {
          return true;
        }
        if (premium.indexOf(action.name) === -1) {
          return true;
        }
        if (['basic'].indexOf(req.primaryProject.plan) !== -1) {
          _debug('Skipping ' + action.name + ' action, because the project plan is ' + req.primaryProject.plan);
          return false;
        }

        return true;
      },

      actionRoutes: function(handlers) {
        handlers.beforePost = handlers.beforePost || [];
        handlers.beforePut = handlers.beforePut || [];
        handlers.beforeDelete = handlers.beforeDelete || [];

        var projectProtectAccess = require('../middleware/projectProtectAccess')(formioServer.formio);

        _.each(['beforePost', 'beforePut', 'beforeDelete'], function(handler) {
          handlers[handler].unshift(projectProtectAccess);
        });

        // On action creation, if the action is a moxtraMessage action, add the user _id to the request payload.
        let addCurrentUserToAction = (req, res, next) => {
          if (['POST', 'PUT'].indexOf(req.method) === -1 || !req.user) {
            return next();
          }
          let userActions = ['moxtraMessage', 'moxtraTodo'];
          if (userActions.indexOf(_.get(req.body, 'name')) === -1) {
            return next();
          }

          let user;
          try {
            user = req.user.toObject();
          }
          catch (e) {
            user = req.user;
          }

          _.set(req.body, 'settings.user', user._id);
          return next();
        };

        handlers.beforePost.push(addCurrentUserToAction);
        handlers.beforePut.push(addCurrentUserToAction);

        return handlers;
      },

      emailTransports: function(transports, settings) {
        settings = settings || {};
        var office365 = settings.office365 || {};
        if (office365.tenant && office365.clientId && office365.email && office365.cert && office365.thumbprint) {
          transports.push(
            {
              transport: 'outlook',
              title: 'Outlook'
            }
          );
        }
        return transports;
      },
      path: function(url, req) {
        return '/project/' + req.projectId + url;
      },
      skip: function(_default, req) {
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
      fieldUrl: function(url, form, field) {
        return '/project/' + form.project + url;
      },
      host: function(host, req) {
        // Load the project settings.
        var project = cache.currentProject(req);
        return project.name + '.' + host;
      },

      /**
       * Modify the given token.
       *
       * @param token {Object}
       *   The initial formio user token.
       * @param form {Object}
       *   The initial formio user resource form.
       *
       * @returns {Object}
       *   The modified token.
       */
      token: function(token, form) {
        token.origin = formioServer.formio.config.apiHost;
        token.form.project = form.project;
        return token;
      },

      /**
       * Modify the temp token to add a redis id to it.
       *
       * @param req
       * @param res
       * @param token
       * @param allow
       * @param expire
       * @param tempToken
       */
      tempToken: function(req, res, token, allow, expire, tokenResponse) {
        let redis = formioServer.analytics.getRedis();
        if (redis) {
          tokenResponse.key = chance.string({
            pool: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            length: 30
          });
          redis.set(tokenResponse.key, tokenResponse.token, 'EX', expire);
        }
      },

      isAdmin: function(isAdmin, req) {
        var _debug = require('debug')('formio:settings:isAdmin');

        // Allow admin key to act as admin.
        if (process.env.ADMIN_KEY && process.env.ADMIN_KEY === req.headers['x-admin-key']) {
          _debug('Admin Key');
          req.adminKey = true;
          return true;
        }

        // Allow remote team admins to have admin access.
        if (req.remotePermission && ['admin', 'owner', 'team_admin'].indexOf(req.remotePermission)) {
          _debug('Remote Admin');
          return true;
        }

        // If no user is found, then return false.
        if (!req.token || !req.token.user) {
          _debug('Skipping - No user given');
          return false;
        }

        // Ensure we have a projectOwner
        if (!req.projectOwner) {
          _debug('Skipping - No project owner');
          return false;
        }

        // Project owners are default admins.
        if (req.token.user._id === req.projectOwner) {
          _debug('Project owner');
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
      getAccess: function(handlers, req, res, access) {
        /**
         * Calculate the project access.
         *
         * @param callback {Function}
         *   The callback function to invoke after completion.
         */
        var getProjectAccess = function(callback) {
          var _debug = require('debug')('formio:settings:getAccess#getProjectAccess');

          // Build the access object for this project.
          access.project = {};

          // Skip project access if no projectId was given.
          if (!req.projectId) {
            _debug('Skipping, no req.projectId');
            return callback(null);
          }

          // Load the project.
          cache.loadProject(req, req.projectId, function(err, project) {
            if (err) {
              _debug(err);
              return callback(err);
            }
            if (!project) {
              _debug('No project found with projectId: ' + req.projectId);
              return callback('No project found with projectId: ' + req.projectId);
            }

            // Add the current project to the req.
            try {
              req.currentProject = project.toObject();
            }
            catch (err) {
              req.currentProject = project;
            }

            cache.loadPrimaryProject(req, function(err, primaryProject) {
              // Add the current project to the req.
              try {
                req.primaryProject = primaryProject.toObject();
              }
              catch (err) {
                req.primaryProject = primaryProject;
              }

              // Store the Project Owners UserId, because they will have all permissions.
              if (primaryProject.owner) {
                access.project.owner = primaryProject.owner.toString();

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
              _debug(JSON.stringify(access));
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
        var getTeamAccess = function(callback) {
          var _debug = require('debug')('formio:settings:getAccess#getTeamAccess');

          // Modify the project access with teams functionality.
          access.project = access.project || {};

          // Skip teams access if no projectId was given.
          if (!req.projectId) {
            _debug('Skipping, no req.projectId');
            return callback(null);
          }

          // Load the project.
          /* eslint-disable camelcase, max-statements, no-fallthrough */
          cache.loadPrimaryProject(req, function(err, project) {
            if (err) {
              _debug(err);
              return callback(err);
            }
            if (!project) {
              _debug('No project found with projectId: ' + req.projectId);
              return callback('No project found with projectId: ' + req.projectId);
            }

            // Skip teams processing, if this projects plan does not support teams.
            _debug(JSON.stringify(project));
            if (!project.plan || project.plan === 'basic' || project.plan === 'independent') {
              return callback(null);
            }

            // Iterate the project access permissions, and search for teams functionality.
            if (project.access) {
              var teamAccess = _.filter(project.access, function(permission) {
                return _.startsWith(permission.type, 'team_');
              });
              //_debug('Team Permissions: ' + JSON.stringify(teamAccess));
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

              teamAccess.forEach(function(permission) {
                _debug(permission);
                permission.roles = permission.roles || [];
                // Note: These roles are additive. team_admin gets all roles in team_write and team_read.
                // Iterate each team in the team roles, and add their permissions.
                permission.roles.forEach(function(id) {
                   switch (permission.type) {
                    case 'team_admin':
                      access.project.update_all.push(id.toString());
                      access.project.delete_all.push(id.toString());
                    case 'team_write':
                      access.project.create_all.push(id.toString()); // This controls form creation.
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
                      access.project.read_all.push(id.toString());
                      access.form.read_all.push(id.toString());
                      access.submission.read_all.push(id.toString());
                      access.role.read_all.push(id.toString());
                      break;
                  }
                });
              });
            }

            // Pass the access of this Team to the next function.
            //_debug(JSON.stringify(access));
            return callback(null);
          });
          /* eslint-enable camelcase, max-statements, no-fallthrough */
        };

        // Get the permissions for an Project with the given ObjectId.
        handlers.unshift(
          formioServer.formio.plans.checkRequest(req, res),
          getProjectAccess,
          getTeamAccess
        );
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
      resourceAccessFilter: function(query, req, callback) {
        var _debug = require('debug')('formio:settings:resourceAccessFilter');
        if (!req.projectId || !_.get(req, 'token.user._id')) {
          _debug('Required items not available.');
          return callback(null, query);
        }

        formioServer.formio.plans.getPlan(req, function(err, plan) {
          if (err) {
            _debug(err);
            return callback(err, query);
          }

          // FOR-209 - Skip group permission checks for non-team/commercial project plans.
          if (['team', 'commercial'].indexOf(plan) === -1) {
            _debug('Skipping additional permission checks, plan: ', plan);
            return callback(null, query);
          }

          // Get all the possible groups in the project
          formioServer.formio.resources.form.model.aggregate(
            // Get all the forms for the current project.
            {$match: {
              project: formioServer.formio.util.idToBson(req.projectId),
              deleted: {$eq: null}
            }},
            {$project: {'form._id': '$_id', _id: 0}},

            // Get all the group assignment actions for the forms in the pipeline
            {$lookup: {from: 'actions', localField: 'form._id', foreignField: 'form', as: 'action'}},
            {$match: {action: {$exists: true, $ne: []}}},
            {$unwind: '$action'},
            {$match: {'action.deleted': {$eq: null}, 'action.name': 'group', 'action.settings.user': {$exists: true}}},
            {$project: {form: 1, action: {_id: '$action._id', settings: '$action.settings'}}},

            // Get all the groups that the current user is a member of, or owns
            {$lookup: {from: 'submissions', localField: 'form._id', foreignField: 'form', as: 'submission'}},
            {$unwind: '$submission'},
            {$match: {$or: [
              {'submission.data.user': {$exists: true}},
              {'submission.owner': formioServer.formio.util.idToBson(req.token.user._id)}
            ]}},
            {$project: {form: 1, action: 1, submission: {
              _id: '$submission._id',
              data: {
                user: {
                  $cond: [
                    {$anyElementTrue: [['$submission.data.user._id']]},
                    '$submission.data.user._id',
                    '$submission.data.user'
                  ]
                },
                group: '$submission.data.group._id'
              },
              owner: '$submission.owner'
            }}},
            {$group: {
              _id: {group: '$submission.data.group', owner: '$submission.owner'},
              users: {$push: '$submission.data.user'}
            }},
            {$project: {
              _id: '$_id.group',
              owner: '$_id.owner',
              users: '$users'
            }},
            {$match: {$or: [
              {users: formioServer.formio.util.idToString(req.token.user._id)},
              {owner: formioServer.formio.util.idToBson(req.token.user._id)}
            ]}},
            function(err, groups) {
              if (err) {
                // Try to recover from failure, but passing the original query on.
                _debug(err);
                return callback(err, query);
              }

              _debug(groups);
              groups.forEach(function(group) {
                query.push(formioServer.formio.util.idToBson(group._id));
              });

              return callback(null, query, groups);
            }
          );
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
      accessEntity: function(entity, req) {
        if (!entity && req.projectId) {
          // If the entity does not exist, and a projectId is present, then this is a project related access check.
          entity = {
            type: 'project',
            id: req.projectId
          };
        }
        else if (entity && entity.type === 'form') {
          // If this is a create form or index form, use the project as the access entity.
          var createForm = ((req.method === 'POST') && (Boolean(req.formId) === false));
          var indexForm = ((req.method === 'GET') && (Boolean(req.formId) === false));
          if (createForm || indexForm) {
            entity = {
              type: 'project',
              id: req.projectId
            };
          }
        }

        var url = nodeUrl.parse(req.url).pathname.split('/');
        debug.settings(url);
        if (url[5] === 'storage' && ['s3', 'dropbox'].indexOf(url[6]) !== -1) {
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
      hasAccess: function(_hasAccess, req, access, entity, res) {
        var _debug = require('debug')('formio:settings:hasAccess');
        var _url = nodeUrl.parse(req.url).pathname;

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
          }
          return permission;
        }

        // Check requests not pointed at specific projects.
        if (!entity && !req.projectId) {
          // No project but authenticated.
          if (req.token) {
            if (req.method === 'POST' && _url === '/project') {
              _debug(req.userProject.primary);
              return req.userProject.primary;
            }

            if (_url === '/project') {
              _debug('true');
              return true;
            }

            if (_url === '/project/available') {
              _debug(req.userProject.primary);
              return req.userProject.primary;
            }

            if (_url === '/payeezy') {
              _debug(req.userProject.primary);
              return req.userProject.primary;
            }

            _debug('Checking for Formio Access.');
            _debug('Formio URL: ' + _url);
            if (_url === '/current' || _url === '/logout') {
              _debug('true');
              return true;
            }

            // This req is unauthorized/unknown.
            _debug('false');
            if (res) {
              res.sendStatus(404);
            }
            return false;
          }
          // No project but anonymous.
          else {
            if (_url === '/spec.json') {
              _debug('true');
              return true;
            }

            // This req is unauthorized.
            _debug('false');
            return false;
          }
        }

        else if (req.projectId && req.token && req.url === '/project/' + req.projectId + '/report') {
          return true;
        }

        // Allow access to current tag endpoint.
        else if (req.projectId && req.url === '/project/' + req.projectId + '/tag/current') {
          return true;
        }

        else if (req.token && access.project && access.project.owner) {
          var url = req.url.split('/');

          // Use submission permissions for access to file signing endpoints.
          if (url[5] === 'storage' && ['s3', 'dropbox'].indexOf(url[6]) !== -1) {
            _debug('Checking storage access');
            var _access = formioServer.formio.access.hasAccess(req, access, {
              type: 'submission',
              id: req.submissionId
            });
            _debug(_access);
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
       * Hook the available permission types in the PermissionSchema.
       *
       * @param available {Array}
       *   The available permission types.
       *
       * @return {Array}
       *   The updated permission types.
       */
      permissionSchema: function(available) {
        available.push('team_read', 'team_write', 'team_admin');
        return available;
      },

      importActionQuery: function(query, action, template) {
        query.form = formioServer.formio.util.idToBson(action.form);
        return query;
      },

      importFormQuery: function(query, form, template) {
        query.project = formioServer.formio.util.idToBson(form.project);
        return query;
      },

      importRoleQuery: function(query, role, template) {
        query.project = formioServer.formio.util.idToBson(role.project);
        return query;
      },

      defaultTemplate: function(template, options) {
        template.access = options.access;
        return template;
      },

      templateAlters: function(alters) {
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

        alters.form = (item, template, done) => {
          item.project = template._id;
          this.formMachineName(item.machineName, item, (err, machineName) => {
            if (err) {
              return done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        };

        alters.action = (item, template, done) => {
          item.project = template._id;
          this.actionMachineName(item.machineName, item, (err, machineName) => {
            if (err) {
              return done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        };

        return alters;
      },

      templateImportSteps: (steps, install, template) => {
        let _install = install({
          model: formioServer.formio.resources.project.model,
          valid: entity => {
            let project = entity[template.machineName || template.name || 'project'];
            if (!project || !project.title) {
              return false;
            }

            return true;
          },
          cleanUp: (template, items, done) => {
            template._id = items[template.machineName || template.name]._id;

            return done();
          }
        });
        let project = {};
        let projectKeys = ['title', 'name', 'tag', 'description', 'machineName'];

        project[template.machineName || template.name || 'export'] = _.pick(template, projectKeys);

        project[template.machineName || template.name || 'export'].primary = !!template.isPrimary;

        steps.unshift(async.apply(_install, template, project));

        let _importAccess = (template, items, done) => {
          formioServer.formio.resources.project.model.findOne({_id: template._id}, function(err, project) {
            if (err) {
              return done(err);
            }

            if ('access' in template) {
              debug.import('start access');
              let permissions = ['create_all', 'read_all', 'update_all', 'delete_all'];
              project.access = _.filter(project.access, access => permissions.indexOf(access.type) === -1);

              debug.import(template.roles);
              template.access.forEach(access => {
                project.access.push({
                  type: access.type,
                  roles: _.filter(access.roles).map(name => {
                    if (template.roles.hasOwnProperty(name)) {
                      return template.roles[name]._id;
                    }
                    return name;
                  })
                });
              });
              debug.import('end access');
            }
            else if (
              'roles' in template &&
              Object.keys(template.roles).length > 0 &&
              'administrator' in template.roles
            ) {
              // Add all roles to read_all.
              let readAllRoles = [];
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
            project.save(done);
          });
        };

        steps.push(async.apply(_importAccess, template, project));
        return steps;
      },

      templateExportSteps: (steps, template, map, options) => {
        let _exportAccess = function(_export, _map, options, next) {
          // Clean up roles to point to machine names.
          let accesses = _.cloneDeep(_export.access);
          _export.access = [];
          _.each(accesses, function(access) {
            if (access.type.indexOf('team_') === -1) {
              const roleNames = access.roles.map(roleId => _map.roles[roleId.toString()]);
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

      exportOptions: function(options, req, res) {
        var currentProject = cache.currentProject(req);
        options.title = currentProject.title;
        options.tag = currentProject.tag;
        options.name = currentProject.name;
        options.description = currentProject.description;
        options.projectId = currentProject._id.toString() || req.projectId || req.params.projectId || 0;
        options.access = currentProject.access.toObject();

        return options;
      },

      importOptions: function(options, req, res) {
        var currentProject = cache.currentProject(req);
        options._id = currentProject._id;
        options.name = currentProject.name;
        options.machineName = currentProject.machineName;

        return options;
      },

      requestParams: function(req, params) {
        var projectId = params.project;
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
      user: function(user, next) {
        if (!user) {
          return next();
        }

        var _debug = require('debug')('formio:settings:user');
        var util = formioServer.formio.util;
        _debug(user);

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

        // Convert all the roles to strings
        user.roles = _(user.roles)
          .filter()
          .map(util.idToString)
          .uniq()
          .value();
        debug.settings(user.roles);

        formioServer.formio.teams.getTeams(user, true, true)
          .then(function(teams) {
            // Filter the teams to only contain the team ids.
            _debug('RAW: ' + JSON.stringify(teams));
            teams = _(teams)
              .map('_id')
              .filter()
              .map(util.idToString)
              .uniq()
              .forEach(function(team) {
                // Add the users team ids, to their roles.
                user.roles.push(team);
              });

            _debug('Teams: ' + JSON.stringify(teams));
            _debug('Final User Roles: ' + JSON.stringify(user.roles));
            return user;
          })
          .nodeify(next);
      },

      /**
       * Allow a user with the correct jwt secret, to skip user loading and supply their own permissions check.
       *
       * @param decoded
       * @param req
       * @returns {boolean}
       */
      external: function(decoded, req) {
        // If external is provided in the signed token, use the decoded token as the request token.
        if (decoded.external === true) {
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
      formQuery: function(query, req, formio) {
        var _debug = require('debug')('formio:settings:formQuery');

        // Determine which project to use, one in the request, or formio.
        _debug('formio: ' + formio);
        if (formio && formio === true) {
          return cache.loadProjectByName(req, 'formio', function(err, _id) {
            if (err || !_id) {
              _debug(err || 'The formio project was not found.');
              return query;
            }

            query.project = formioServer.formio.mongoose.Types.ObjectId(_id);
            _debug(query);
            return query;
          });
        }
        else {
          req.projectId = req.projectId || (req.params ? req.params.projectId : undefined) || req._id;
          query.project = formioServer.formio.mongoose.Types.ObjectId(req.projectId);
          _debug(query);
          return query;
        }
      },
      formSearch: function(search, model, value) {
        search.project = model.project;
        return search;
      },
      cacheInit: function(cache) {
        cache.projects = {};
        return cache;
      },
      submissionParams: function(params) {
        params.push('oauth');
        return params;
      },
      submissionRequestQuery: function(query, req) {
        query.projectId = req.projectId;
        return query;
      },
      submissionRequestTokenQuery: function(query, token) {
        query.projectId = token.form.project;
        return query;
      },
      formRoutes: function(routes) {
        routes.before.unshift(require('../middleware/projectProtectAccess')(formioServer.formio));
        return routes;
      },
      submissionRoutes: function(routes) {
        var filterExternalTokens = formioServer.formio.middleware.filterResourcejsResponse(['externalTokens']);
        var conditionalFilter = function(req, res, next) {
          if (req.token && res.resource && res.resource.item && res.resource.item._id) {
            // Only allow tokens for the actual user.
            if (req.token.user._id !== res.resource.item._id.toString()) {
              return filterExternalTokens(req, res, next);
            }

            // Whitelist which tokens can be seen on the frontend.
            var allowedTokens = ['dropbox'];
            res.resource.item.externalTokens = _.filter(res.resource.item.externalTokens, function(token) {
              return _.indexOf(allowedTokens, token.type) > -1;
            });

            return next();
          }
          else {
            return filterExternalTokens(req, res, next);
          }
        };

        _.each(['afterGet', 'afterIndex', 'afterPost', 'afterPut', 'afterDelete'], function(handler) {
          routes[handler].push(conditionalFilter);
        });

        return routes;
      },
      roleRoutes: function(routes) {
        routes.before.unshift(require('../middleware/bootstrapEntityProject'), require('../middleware/projectFilter'));
        routes.before.unshift(require('../middleware/projectProtectAccess')(formioServer.formio));
        return routes;
      },
      submissionSchema: function(schema) {
        // Defines what each external Token should be.
        var ExternalTokenSchema = formioServer.formio.mongoose.Schema({
          type: String,
          token: String,
          exp: Date
        });
        schema.externalTokens = [ExternalTokenSchema];
        return schema;
      },
      newRoleAccess: function(handlers, req) {
        var projectId = req.projectId;

        /**
         * Async function to add the new role to the read_all access of the project.
         *
         * @param done
         */
        var updateProject = function(_role, done) {
          var _debug = require('debug')('formio:settings:updateProject');

          formioServer.formio.resources.project.model.findOne({
            _id: formioServer.formio.mongoose.Types.ObjectId(projectId)
          }, function(err, project) {
            if (err) {
              _debug(err);
              return done(err);
            }
            if (!project) {
              _debug('No Project found with projectId: ' + projectId);
              return done();
            }

            // Add the new roleId to the access list for read_all (project).
            _debug('Loaded project: ' + JSON.stringify(project));
            project.access = project.access || [];
            var found = false;
            for (var a = 0; a < project.access.length; a++) {
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
            project.save(function(err) {
              if (err) {
                _debug(err);
                return done(err);
              }

              _debug('Updated Project: ' + JSON.stringify(project.toObject()));
              done();
            });
          });
        };

        // Update the project when new roles are added.
        handlers.unshift(updateProject);
        return handlers;
      },
      roleQuery: function(query, req) {
        var projectId = req.projectId || (req.params ? req.params.projectId : undefined) || req._id;
        query.project = formioServer.formio.util.idToBson(projectId);
        return query;
      },
      roleSearch: function(search, model, value) {
        return this.formSearch(search, model, value);
      },
      roleSchema: function(schema) {
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
      formMachineName: function(machineName, document, done) {
        formioServer.formio.resources.project.model.findOne({_id: document.project, deleted: {$eq: null}})
        .exec(function(err, project) {
          if (err) {
            return done(err);
          }

          done(null, project.machineName + ':' + machineName);
        });
      },
      roleMachineName: function(machineName, document, done) {
        this.formMachineName(machineName, document, done);
      },
      actionMachineName: function(machineName, document, done) {
        formioServer.formio.resources.form.model.findOne({_id: document.form, deleted: {$eq: null}})
          .exec((err, form) => {
            if (err) {
              return done(err);
            }

            this.formMachineName(machineName, form, done);
          });
      },
      machineNameExport: function(machineName) {
        if (!machineName) {
          return 'export';
        }

        var parts = machineName.split(':');
        if (parts.length === 1) {
          return parts.pop();
        }

        // Remove the project portion of the machine name.
        parts.shift();

        // Rejoin the machine name as : seperated.
        return parts.join(':');
      },
      exportComponent: function(component) {
        if (component.type === 'resource') {
          component.project = 'project';
        }
      },
      importComponent: function(template, component) {
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
      updateConfig: function(config) {
        var _debug = require('debug')('formio:settings:config');

        // Hook the schema var to load the latest public/private schema.
        var pkg = JSON.parse(fs.readFileSync('./package.json'));
        if (pkg && pkg.schema && pkg.schema !== null && semver.gt(pkg.schema, config.schema)) {
          config.schema = pkg.schema;
        }

        // Hook the config to add redis data for the update script: 3.0.1-rc.2
        config.redis = formioServer.config.redis;

        _debug(config);
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
      getUpdates: function(files, next) {
        var _debug = require('debug')('formio:settings:getUpdates');
        files = files || [];

        _debug(files);
        var _files = require('../db/updates/index.js');
        _files = Object.keys(_files);
        // Add the private updates to the original file list and continue.
        files = files.concat(_files);
        _debug(files);
        next(null, files);
      },

      /**
       * A hook to expose the update file paths.
       *
       * @param name {String}
       *   The
       */
      updateLocation: function(name) {
        var _debug = require('debug')('formio:settings:updateLocation');
        var update = null;

        try {
          // Attempt to resolve the private update.
          var _files = require('../db/updates/index.js');
          if (_files.hasOwnProperty(name)) {
            _debug('Using ' + name);
            update = _files[name];
          }
          else {
            _debug('update not found (' + name + '): ' + Object.keys(_files).join(', '));
          }
        }
        catch (e) {
          _debug(e);
          debug.error(e);
          update = null;
        }

        return update;
      }
    }
  };
};
