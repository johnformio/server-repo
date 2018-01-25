'use strict';

const _ = require('lodash');
const o365Util = require('../actions/office365/util');
const kickboxValidate = require('../actions/kickbox/validate');
const nodeUrl = require('url');
const semver = require('semver');
const async = require('async');
const chance = new (require('chance'))();
const fs = require('fs');
const url = require('url');
const util = require('../util/util');

module.exports = function(app) {
  const formioServer = app.formio;

  // Add the encrypt handler.
  const encrypt = require('../util/encrypt')(formioServer);

  // Attach the project plans to the formioServer
  formioServer.formio.plans = require('../plans/index')(formioServer);

  // Attach the teams to formioServer.
  formioServer.formio.teams = require('../teams/index')(app, formioServer);

  // Mount the analytics API.
  formioServer.analytics.endpoints(app, formioServer);

  // Handle Payeezy form signing requests and project upgrades
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
      init(type, formio) {
        switch (type) {
          case 'alias':
            // Dynamically set the baseUrl.
            formio.middleware.alias.baseUrl = function(req) {
              const baseUrl = `/project/${req.projectId}`;
              // Save the alias as well.
              req.pathAlias = url.parse(req.url).pathname.substr(baseUrl.length);
              return baseUrl;
            };

            // Add the alias handler.
            app.use(formio.middleware.alias);
            return true;
          case 'params':
            app.use(formio.middleware.params);
            return true;
          case 'token':
            app.use(require('../middleware/remoteToken')(app));
            app.use(require('../middleware/aliasToken')(app));
            app.use(formio.middleware.tokenHandler);
            app.use(require('../middleware/userProject')(formioServer.formio));
            return true;
          case 'logout':
            app.get('/logout', formio.auth.logout);
            return false;
          case 'getTempToken':
            app.get('/token', formio.auth.tempToken);
            return false;
          case 'current':
            app.get('/current', (req, res, next) => {
              // If this is an external token, return the user object directly.
              if (req.token.external) {
                if (!res.token || !req.token) {
                  return res.sendStatus(401);
                }

                // Set the headers if they haven't been sent yet.
                if (!res.headersSent) {
                  res.setHeader('Access-Control-Expose-Headers', 'x-jwt-token');
                  res.setHeader('x-jwt-token', res.token);
                }

                return res.send(req.token.user);
              }
              return formio.auth.currentUser(req, res, next);
            });
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
      formRequest(req, res) {
        // Make sure to always include the projectId in POST and PUT calls.
        if (req.method === 'PUT' || req.method === 'POST') {
          req.body.project = req.projectId || req.params.projectId;
        }
      },
      validateEmail(component, path, req, res, next) {
        if (
          (component.type === 'email') &&
          component.kickbox &&
          component.kickbox.enabled
        ) {
          // Load the project settings.
          formioServer.formio.cache.loadProject(req, req.projectId, function(err, project) {
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
      email(transport, settings, projectSettings, req, res, params) {
        const transporter = {};
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
      formio: require('./alter/formio')(app),
      resources(resources) {
        return _.assign(resources, require('../resources/resources')(app, formioServer));
      },
      FormResource: require('./alter/FormResource')(app),
      models: require('./alter/models')(app),
      email: require('./alter/email')(app),
      validateSubmissionForm: require('./alter/validateSubmissionForm')(app),
      actions(actions) {
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

      export(req, query, form, exporter, cb) {
        util.getSubmissionModel(formioServer.formio, req, form, true, (err, submissionModel) => {
          if (err) {
            return cb(err);
          }

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
      resolve(defaultReturn, action, handler, method, req, res) {
        if (process.env.DISABLE_RESTRICTIONS) {
          return true;
        }
        const premium = [
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
          return false;
        }

        return true;
      },

      emailTransports(transports, settings) {
        settings = settings || {};
        const office365 = settings.office365 || {};
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
      path(url, req) {
        return `/project/${req.projectId}${url}`;
      },
      skip(_default, req) {
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
       *
       * @returns {Object}
       *   The modified token.
       */
      token(token, form) {
        token.origin = formioServer.formio.config.apiHost;
        token.form.project = form.project;
        token.project = {
          _id: form.project
        };
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
      tempToken(req, res, allow, expire, tokenResponse, cb) {
        if (formioServer.redis.db) {
          const tempToken = chance.string({
            pool: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            length: 30
          });
          formioServer.redis.db.set(tempToken, tokenResponse.token, 'EX', expire, (err) => {
            if (err) {
              return res.status(500).send(err.message);
            }

            tokenResponse.key = tempToken;
            cb();
          });
        }
        else {
          return cb();
        }
      },

      isAdmin(isAdmin, req) {
        // Allow admin key to act as admin.
        if (process.env.ADMIN_KEY && process.env.ADMIN_KEY === req.headers['x-admin-key']) {
          req.adminKey = true;
          return true;
        }

        // Allow remote team admins to have admin access.
        if (req.remotePermission && ['admin', 'owner', 'team_admin'].indexOf(req.remotePermission)) {
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

            // Add the current project to the req.
            try {
              req.currentProject = project.toObject();
            }
            catch (err) {
              req.currentProject = project;
            }

            formioServer.formio.cache.loadPrimaryProject(req, function(err, primaryProject) {
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

          // Load the project.
          /* eslint-disable camelcase, max-statements, no-fallthrough */
          formioServer.formio.cache.loadPrimaryProject(req, function(err, project) {
            if (err) {
              return callback(err);
            }
            if (!project) {
              return callback(`No project found with projectId: ${req.projectId}`);
            }

            // Skip teams processing, if this projects plan does not support teams.
            if (!project.plan || project.plan === 'basic' || project.plan === 'independent') {
              return callback(null);
            }

            // Iterate the project access permissions, and search for teams functionality.
            if (project.access) {
              const teamAccess = _.filter(project.access, function(permission) {
                return _.startsWith(permission.type, 'team_');
              });
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
      resourceAccessFilter(query, req, callback) {
        if (!req.projectId || !_.get(req, 'token.user._id')) {
          return callback(null, query);
        }

        // Do not perform if the database is CosmosDB.
        if (_.get(formioServer, 'formio.config.mongo', '').indexOf('documents.azure.com') !== -1) {
          return callback(null, query);
        }

        formioServer.formio.plans.getPlan(req, function(err, plan) {
          if (err) {
            return callback(err, query);
          }

          // FOR-209 - Skip group permission checks for non-team/commercial project plans.
          if (['team', 'commercial'].indexOf(plan) === -1) {
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
                return callback(err, query);
              }

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
          }
          return permission;
        }

        // Check requests not pointed at specific projects.
        if (!entity && !req.projectId) {
          // No project but authenticated.
          if (req.token) {
            if (req.method === 'POST' && _url === '/project') {
              return req.userProject.primary;
            }

            if (_url === '/project') {
              return true;
            }

            if (_url === '/project/available') {
              return req.userProject.primary;
            }

            if (_url === '/payeezy') {
              return req.userProject.primary;
            }

            if (_url === '/current' || _url === '/logout') {
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
            if (_url === '/spec.json') {
              return true;
            }

            // This req is unauthorized.
            return false;
          }
        }

        else if (req.projectId && req.token && req.url === `/project/${req.projectId}/report`) {
          return true;
        }

        // Allow access to current tag endpoint.
        else if (req.projectId && req.url === `/project/${req.projectId}/tag/current`) {
          return true;
        }

        else if (req.token && access.project && access.project.owner) {
          const url = req.url.split('/');

          // Use submission permissions for access to file signing endpoints.
          if (url[5] === 'storage' && ['s3', 'dropbox'].indexOf(url[6]) !== -1) {
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
       * Hook the available permission types in the PermissionSchema.
       *
       * @param available {Array}
       *   The available permission types.
       *
       * @return {Array}
       *   The updated permission types.
       */
      permissionSchema(available) {
        available.push('team_read', 'team_write', 'team_admin');
        return available;
      },

      importActionQuery(query, action, template) {
        query.form = formioServer.formio.util.idToBson(action.form);
        return query;
      },

      importFormQuery(query, form, template) {
        query.project = formioServer.formio.util.idToBson(form.project);
        return query;
      },

      importRoleQuery(query, role, template) {
        query.project = formioServer.formio.util.idToBson(role.project);
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
            }, (err, doc) => {
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

              doc.set('_vid', parseInt(doc._vid) + 1);
              doc.save((err, result) => {
                if (err) {
                  return done(err);
                }

                const body = Object.assign({}, item);
                body._rid = result._id;
                body._vid = result._vid;
                body._vuser = 'system';
                body._vnote = `Deploy version tag ${template.tag}`;
                delete body._id;
                delete body.__v;

                formioServer.formio.mongoose.models.formrevision.create(body, () => {
                  done(null, item);
                });
              });
            });
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
        const _install = install({
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
        });
        const project = {};
        const projectKeys = ['title', 'name', 'tag', 'description', 'machineName'];

        project[template.machineName || template.name || 'export'] = _.pick(template, projectKeys);

        project[template.machineName || template.name || 'export'].primary = !!template.isPrimary;

        steps.unshift(async.apply(_install, template, project));

        const _importAccess = (template, items, done) => {
          formioServer.formio.resources.project.model.findOne({_id: template._id}, function(err, project) {
            if (err) {
              return done(err);
            }

            if (!project) {
              return done();
            }

            if ('access' in template) {
              const permissions = ['create_all', 'read_all', 'update_all', 'delete_all'];
              project.access = _.filter(project.access, access => permissions.indexOf(access.type) === -1);

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
            }
            else if (
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
            project.save(done);
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

      exportOptions(options, req, res) {
        const currentProject = formioServer.formio.cache.currentProject(req);
        options.title = currentProject.title;
        options.tag = currentProject.tag;
        options.name = currentProject.name;
        options.description = currentProject.description;
        options.projectId = currentProject._id.toString() || req.projectId || req.params.projectId || 0;
        options.access = currentProject.access.toObject();

        return options;
      },

      importOptions(options, req, res) {
        const currentProject = formioServer.formio.cache.currentProject(req);
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

        const util = formioServer.formio.util;

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

        formioServer.formio.teams.getTeams(user, true, true)
          .then(function(teams) {
            if (!teams || !teams.length) {
              return user;
            }

            // Filter the teams to only contain the team ids.
            teams = _(teams)
              .map('_id')
              .filter()
              .map(util.idToString)
              .uniq()
              .forEach(function(team) {
                // Add the users team ids, to their roles.
                user.roles.push(team);
              });

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
      external(decoded, req) {
        // If external is provided in the signed token, use the decoded token as the request token.
        // Only allow external tokens for the projects they originated in.
        if (decoded.external === true && req.projectId && req.projectId === decoded.project._id) {
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

            query.project = formioServer.formio.mongoose.Types.ObjectId(_id);
            return query;
          });
        }
        else {
          req.projectId = req.projectId || (req.params ? req.params.projectId : undefined) || req._id;
          if (formioServer.formio.mongoose.Types.ObjectId.isValid(req.projectId)) {
            query.project = formioServer.formio.mongoose.Types.ObjectId(req.projectId);
          }
          return query;
        }
      },
      formSearch(search, model, value) {
        search.project = model.project;
        return search;
      },
      cacheInit(cache) {
        cache.projects = {};
        return cache;
      },
      submission(req, res, next) {
        if (req.body.hasOwnProperty('_fvid') && typeof res.submission === 'object') {
          res.submission._fvid = req.body._fvid;
        }
        encrypt.handle(req, res, next);
      },
      submissionParams(params) {
        params.push('oauth', '_fvid');
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
      formRoutes: require('./alter/formRoutes')(app),
      submissionRoutes: require('./alter/submissionRoutes')(app),

      actionRoutes(routes) {
        routes.beforePost = routes.beforePost || [];
        routes.beforePut = routes.beforePut || [];
        routes.beforeDelete = routes.beforeDelete || [];

        const Moxtra = require('../actions/moxtra/utils')(app.formio);
        const projectProtectAccess = require('../middleware/projectProtectAccess')(formioServer.formio);

        _.each(['beforePost', 'beforePut', 'beforeDelete'], handler => {
          routes[handler].unshift(projectProtectAccess);
        });

        // On action creation, if the action is a moxtraMessage action, add the user _id to the request payload.
        const addCurrentUserToAction = (req, res, next) => {
          if (['POST', 'PUT'].indexOf(req.method) === -1 || !req.user) {
            return next();
          }
          const userActions = ['moxtraMessage', 'moxtraTodo'];
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

        const addFormioBotToMoxtraOrg = (req, res, next) => {
          if (['POST', 'PUT'].indexOf(req.method) === -1 || !req.user) {
            return next();
          }
          if (_.get(req.body, 'name') !== 'moxtraLogin') {
            return next();
          }

          // Create a formio bot token, which will authenticate or create a user. Ignore the token, as we just need the
          // user to exist.
          return Moxtra.getFormioBotToken(req, req.projectId)
          .then(token => {
            return next();
          })
          .catch(error => {
            return next();
          });
        };

        routes.beforePost.push(addCurrentUserToAction, addFormioBotToMoxtraOrg);
        routes.beforePut.push(addCurrentUserToAction, addFormioBotToMoxtraOrg);

        return routes;
      },

      roleRoutes(routes) {
        routes.before.unshift(require('../middleware/bootstrapEntityProject'), require('../middleware/projectFilter'));
        routes.before.unshift(require('../middleware/projectProtectAccess')(formioServer.formio));
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
        const updateProject = function(_role, done) {
          formioServer.formio.resources.project.model.findOne({
            _id: formioServer.formio.mongoose.Types.ObjectId(projectId)
          }, function(err, project) {
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
            project.save(function(err) {
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
        const projectId = req.projectId || (req.params ? req.params.projectId : undefined) || req._id;
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
      formMachineName(machineName, document, done) {
        if (!document) {
          return done(null, machineName);
        }
        formioServer.formio.resources.project.model.findOne({_id: document.project, deleted: {$eq: null}})
        .exec(function(err, project) {
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

        // Hook the config to add redis data for the update script: 3.0.1-rc.2
        config.redis = formioServer.config.redis;
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
      }
    }
  };
};
