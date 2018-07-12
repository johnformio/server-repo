'use strict';

const Resource = require('resourcejs');
const config = require('../../config');
const _ = require('lodash');
const debug = require('debug')('formio:resources:projects');

module.exports = function(router, formioServer) {
  const formio = formioServer.formio;
  const getProjectAccess = function(settings, permissions) {
    return _.chain(settings)
      .filter({type: permissions})
      .head()
      .get('roles', [])
      .map(formio.util.idToString)
      .value();
  };
  const removeProjectSettings = function(req, res, next) {
    // Allow admin key
    if (req.adminKey) {
      return next();
    }
    // Allow project owners.
    if (req.token && req.projectOwner && (req.token.user._id === req.projectOwner)) {
      return next();
    }
    // Allow team admins on remote
    else if (req.remotePermission && (['admin', 'owner', 'team_admin'].indexOf(req.remotePermission) !== -1)) {
      return next();
    }
    else if (req.projectId && req.user) {
      formio.cache.loadPrimaryProject(req, function(err, project) {
        let role = 'read';
        if (!err) {
          const adminAccess = getProjectAccess(project.access, 'team_admin');
          const writeAccess = getProjectAccess(project.access, 'team_write');
          const roles = _.map(req.user.roles, formio.util.idToString);

          if ( _.intersection(adminAccess, roles).length !== 0) {
            return next();
          }
          if ( _.intersection(writeAccess, roles).length !== 0) {
            role = 'write';
          }
        }
        else {
          debug(err);
        }

        if (req.method === 'PUT' || req.method === 'POST') {
          req.body = _.omit(req.body, 'settings');
        }

        const fileToken = role === 'write' && _.get(res, 'resource.item.settings.filetoken', null);

        formio.middleware.filterResourcejsResponse(['settings', 'billing']).call(this, req, res, next);
        if (fileToken) {
          _.set(res, 'resource.item.settings.filetoken', fileToken);
        }
      });
    }
    else {
      if (req.method === 'PUT' || req.method === 'POST') {
        req.body = _.omit(req.body, 'settings');
      }

      formio.middleware.filterResourcejsResponse(['settings', 'billing']).call(this, req, res, next);
    }
  };

  // Load the project plan filter for use.
  formio.middleware.projectPlanFilter = require('../middleware/projectPlanFilter')(formio);
  formio.middleware.projectDefaultPlan = require('../middleware/projectDefaultPlan')(formioServer);

  // Load the project analytics middleware.
  formio.middleware.projectAnalytics = require('../middleware/projectAnalytics')(formioServer);

  // Load the project index filter middleware.
  formio.middleware.projectIndexFilter = require('../middleware/projectIndexFilter')(formioServer);

  // Load the team owner filter for use.
  formio.middleware.projectAccessFilter = require('../middleware/projectAccessFilter')(formio);

  // Load the restrictive middleware to use
  formio.middleware.restrictOwnerAccess = require('../middleware/restrictOwnerAccess')(formio);

  // Load the Environment create middleware.
  formio.middleware.projectEnvCreatePlan = require('../middleware/projectEnvCreatePlan')(formio);
  formio.middleware.projectEnvCreateAccess = require('../middleware/projectEnvCreateAccess')(formio);
  formio.middleware.projectTeamSync = require('../middleware/projectTeamSync')(formio);

  // Load custom hubspot action.
  formio.middleware.customHubspotAction = require('../middleware/customHubspotAction')(formio);

  // Load custom CRM action.
  formio.middleware.customCrmAction = require('../middleware/customCrmAction')(formio);

  const hiddenFields = ['deleted', '__v', 'machineName', 'primary'];
  const resource = Resource(
    router,
    '',
    'project',
    formio.mongoose.model('project')
  ).rest({
    beforeGet: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      (req, res, next) => {
        // Use project cache for performance reasons.
        req.modelQuery = req.modelQuery || req.model || formio.mongoose.model('project');
        next();
      }
    ],
    afterGet: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.projectAnalytics,
      removeProjectSettings
    ],
    beforePost: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      require('../middleware/fetchTemplate'),
      formio.middleware.projectDefaultPlan,
      formio.middleware.projectEnvCreatePlan,
      formio.middleware.projectEnvCreateAccess,
      function(req, res, next) {
        // Don't allow setting billing.
        if (req.body) {
          delete req.body.billing;
        }
        if (req.body && req.body.template) {
          req.template = req.body.template;
          req.templateMode = 'create';
          req.template.isPrimary = (req.template.primary && req.isAdmin && req.adminKey);
          delete req.body.template;
        }
        next();
      },
      formio.middleware.bootstrapEntityOwner(false),
      formio.middleware.projectTeamSync,
      formio.middleware.condensePermissionTypes,
      formio.middleware.projectPlanFilter
    ],
    afterPost: [
      require('../middleware/projectTemplate')(formio),
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.projectAnalytics,
      removeProjectSettings,
      formio.middleware.customHubspotAction,
      formio.middleware.customCrmAction('newproject')
    ],
    beforeIndex: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.projectIndexFilter
    ],
    afterIndex: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.projectAnalytics,
      removeProjectSettings
    ],
    beforePut: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      function(req, res, next) {
        // Don't allow setting billing.
        if (req.body) {
          delete req.body.billing;
        }
        if (req.body && req.body.template) {
          req.template = req.body.template;
          req.templateMode = 'update';
          delete req.body.template;
        }
        next();
      },
      // Protected Project Access.
      function(req, res, next) {
        // Don't allow some changes if project is protected.
        if ('protect' in req.currentProject && req.currentProject.protect === true && req.body.protect !== false) {
          const accesses = {};
          req.currentProject.access.forEach(access => {
            accesses[access.type] = access.roles;
          });
          req.body.name = req.currentProject.name;
          req.body.access = req.body.access || [];
          req.body.access.forEach(access => {
            if (['read_all', 'create_all', 'update_all', 'delete_all'].indexOf(access.type) !== -1) {
              access.roles = accesses[access.type].map(role => role.toString());
              delete accesses[access.type];
            }
          });
          Object.keys(accesses).forEach(key => {
            req.body.access.push({
              type: key,
              roles: accesses[key].map(role => role.toString())
            });
          });
        }

        // Reset the machine name so that it will regenerate.
        if (req.body.name !== req.currentProject.name) {
          req.body.machineName = '';
        }

        next();
      },
      // Don't allow modifying a primary project id.
      function(req, res, next) {
        if (!req.currentProject.hasOwnProperty('project')) {
          delete req.body.project;
        }
        else {
          req.body.project = req.currentProject.project;
        }
        next();
      },
      formio.middleware.projectAccessFilter,
      formio.middleware.projectTeamSync,
      formio.middleware.condensePermissionTypes,
      formio.middleware.projectPlanFilter,
      removeProjectSettings
    ],
    afterPut: [
      require('../middleware/projectTemplate')(formio),
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.projectAnalytics,
      removeProjectSettings,
      formio.middleware.customCrmAction('updateproject'),
      (req, res, next) => {
        /* eslint-disable callback-return */
        next();
        /* eslint-enable callback-return */

        // If the name changed, then re-save all forms, actions, and roles to set the new project name
        if (res.resource && res.resource.item && res.resource.item.name !== req.currentProject.name) {
          let parts = [];
          formio.mongoose.model('form').find({
            deleted: {$eq: null},
            project: req.currentProject._id
          }).then(forms => forms.forEach((form) => {
            parts = form.machineName.split(':');
            if (parts.length === 2) {
              form.machineName = `${res.resource.item.name}:${parts[1]}`;
              form.save();
            }

            formio.mongoose.model('action').find({
              deleted: {$eq: null},
              form: form._id
            }).then(actions => actions.forEach(action => {
              parts = action.machineName.split(':');
              if (parts.length === 3) {
                action.machineName = `${res.resource.item.name}:${parts[1]}:${parts[2]}`;
                action.save();
              }
            }));
          }));

          // Update all roles.
          formio.mongoose.model('role').find({
            deleted: {$eq: null},
            project: req.currentProject._id
          }).then((roles) => roles.forEach(role => {
            parts = role.machineName.split(':');
            if (parts.length === 2) {
              role.machineName = `${res.resource.item.name}:${parts[1]}`;
              role.save();
            }
          }));
        }
      },
    ],
    beforeDelete: [
      require('../middleware/projectProtectAccess')(formio),
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      require('../middleware/deleteProjectHandler')(formio)
    ],
    afterDelete: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.customCrmAction('deleteproject'),
      removeProjectSettings
    ]
  });

  router.post('/project/available', function(req, res, next) {
    if (!req.body || !req.body.name) {
      return res.status(400).send('"name" parameter is required');
    }
    if (config.reservedSubdomains && _.includes(config.reservedSubdomains, req.body.name)) {
      return res.status(200).send({available: false});
    }

    resource.model.findOne({name: req.body.name, deleted: {$eq: null}}, function(err, project) {
      if (err) {
        debug(err);
        return next(err);
      }

      return res.status(200).json({available: !project});
    });
  });

  // Expose the atlassian oauth endpoints.
  const atlassian = require('../actions/atlassian/util')(formioServer);
  router.post(
    '/project/:projectId/atlassian/oauth/authorize',
    formio.middleware.tokenHandler,
    formio.middleware.restrictOwnerAccess,
    atlassian.authorizeOAuth
  );

  router.post(
    '/project/:projectId/atlassian/oauth/finalize',
    formio.middleware.tokenHandler,
    formio.middleware.restrictOwnerAccess,
    atlassian.storeOAuthReply
  );

  // Expose the sql connector endpoint
  const sqlconnector = require('../actions/sqlconnector/util')(formioServer);
  router.get(
    '/project/:projectId/sqlconnector',
    formio.middleware.tokenHandler,
    formio.middleware.restrictOwnerAccess,
    sqlconnector.generateQueries
  );

  return resource;
};
