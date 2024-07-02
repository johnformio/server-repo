'use strict';

const Resource = require('resourcejs');
const config = require('../../config');
const _ = require('lodash');
const debug = require('debug')('formio:resources:projects');
const util = require('../util/util');
const crypto = require('crypto');
const cors = require('cors');

module.exports = (router, formioServer) => {
  const {formio} = formioServer;
  const getProjectAccess = (settings, permissions) => _.chain(settings)
    .find({type: permissions})
    .get('roles', [])
    .map(formio.util.idToString)
    .value();

  const setPublicSettings = (project) => {
    // Migrate "public" settings into an accessible "virtual" property.
    project.public = {
      formModule: _.get(project, 'settings.formModule', ''),
      custom: _.get(project, 'settings.custom', {}),
      defaultStage: _.get(project, 'settings.defaultStage', ''),
    };
  };

  const decryptSettings = (req, res, next, noAdmin) => {
    if (!_.get(res, 'resource.item') || formio.hook.alter('rawDataAccess', req, next)) {
      return;
    }
    // Merge all results into an array, to handle the cases with multiple results.
    const multi = Array.isArray(res.resource.item);
    const list = [].concat(res.resource.item).map(item => {
      util.decryptProperty(item, 'settings_encrypted', 'settings', formio.config.mongoSecret);
      setPublicSettings(item);
      if (noAdmin) {
        delete item.settings;
      }
      _.unset(item, 'settings.portalDomain');
      return item;
    });
    res.resource.item = multi ? list : list[0];
  };

  const projectSettings = async (req, res, next) => {
    // Allow admin key
    if (req.adminKey || req.isAdmin) {
      decryptSettings(req, res, next);
      formioServer.formio.audit('PROJECT_SETTINGS', req);
      return next();
    }
    // Allow project owners.
    if (req.token && req.projectOwner && (req.token.user._id === req.projectOwner)) {
      decryptSettings(req, res, next);
      formioServer.formio.audit('PROJECT_SETTINGS', req);
      return next();
    }
    // Allow team admins on remote
    else if (req.remotePermission && ['admin', 'owner', 'team_admin'].includes(req.remotePermission)) {
      decryptSettings(req, res, next);
      formioServer.formio.audit('PROJECT_SETTINGS', req);
      return next();
    }
    else if (req.projectId && req.user) {
      try {
        const project = await formio.cache.loadPrimaryProject(req);
        let role = 'read';
        const adminAccess = getProjectAccess(project.access, 'team_admin');
        const writeAccess = getProjectAccess(project.access, 'team_write');
        const roles = _.map(req.user.teams, formio.util.idToString);
        const isAdmin = _.intersection(adminAccess, roles).length !== 0;
        decryptSettings(req, res, next, !isAdmin);
        if (isAdmin) {
          formioServer.formio.audit('PROJECT_SETTINGS', req);
          return next();
        }
        if (_.intersection(writeAccess, roles).length !== 0) {
          role = 'write';
        }

        if (req.method === 'GET') {
          _.set(res, 'resource.item.addConfigToForms', _.get(project,'settings.addConfigToForms', false));
        }

        if (req.method === 'PUT' || req.method === 'POST') {
          req.body = _.omit(req.body, 'settings');
        }

        const fileToken = role === 'write' && _.get(res, 'resource.item.settings.filetoken', null);

        formio.middleware.filterResourcejsResponse([
          'settings',
          'settings_encrypted',
          'billing',
        ])(req, res, next);

        if (fileToken) {
          _.set(res, 'resource.item.settings.filetoken', fileToken);
        }
      }
      catch (err) {
        debug(err);
        return next(err);
      }
    }
    else {
      if (req.method === 'PUT' || req.method === 'POST') {
        req.body = _.omit(req.body, 'settings');
      }

      if (req.method === 'GET') {
        _.set(res, 'resource.item.addConfigToForms', _.get(res.req,'currentProject.settings.addConfigToForms', false));
      }

      formio.middleware.filterResourcejsResponse([
        'settings',
        'settings_encrypted',
        'billing',
      ])(req, res, next);
    }
  };
  formio.middleware.projectSettings = projectSettings;

  // Check tenant's parent project plan
   formio.middleware.checkTenantProjectPlan = require('../middleware/checkTenantProjectPlan')(formio);

  // Check stage's parent project
  formio.middleware.checkStageProject = require('../middleware/checkStageProject')(formio);

  // Load the project plan filter for use.
  formio.middleware.projectPlanFilter = require('../middleware/projectPlanFilter')(formio);
  formio.middleware.projectDefaultPlan = require('../middleware/projectDefaultPlan')(formioServer);

  // Load the project usage middleware.
  formio.middleware.projectUsage = require('../middleware/projectUsage')(formioServer);
  formio.middleware.syncProjectUsage = require('../middleware/syncProjectUsage')(formioServer);

  // Load the project index filter middleware.
  formio.middleware.projectIndexFilter = require('../middleware/projectIndexFilter')(formioServer);

  // Load the team owner filter for use.
  formio.middleware.projectAccessFilter = require('../middleware/projectAccessFilter')(formio);

  // Load the restrictive middleware to use
  formio.middleware.restrictProjectAccess = require('../middleware/restrictProjectAccess')(formio);
  formio.middleware.restrictToPlans = require('../middleware/restrictToPlans')(router);

  // Load the Environment create middleware.
  formio.middleware.projectEnvCreatePlan = require('../middleware/projectEnvCreatePlan')(formio);
  formio.middleware.projectEnvCreateAccess = require('../middleware/projectEnvCreateAccess')(formio);
  formio.middleware.projectTeamSync = require('../middleware/projectTeamSync')(formio);

  // Load custom CRM action.
  formio.middleware.customCrmAction = require('../middleware/customCrmAction')(formio);

  // Fix project plan (pull from actual license instead of stored DB value)
  formio.middleware.licenseUtilization = require('../middleware/licenseUtilization').middleware(router);

  formio.middleware.postCreateLicenseCheck = require('../middleware/postCreateLicenseCheck').middleware(router);

  formio.middleware.checkRequestAllowed = require('../middleware/checkRequestAllowed')(formio);

  const hiddenFields = ['deleted', '__v', 'machineName', 'primary'];
  const resource = Resource(
    router,
    '',
    'project',
    formio.mongoose.model('project'),
  ).rest({
    beforeGet: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      (req, res, next) => {
        // Use project cache for performance reasons.
        req.modelQuery = req.modelQuery || req.model || formio.mongoose.model('project');
        next();
      },
    ],
    afterGet: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.licenseUtilization,
      formio.middleware.projectUsage,
      formio.middleware.syncProjectUsage,
      projectSettings,
    ],
    beforePatch: [
      (req, res, next) => res.sendStatus(405),
    ],
    beforePost: [
      formio.middleware.checkRequestAllowed,
      require('../middleware/checkPrimaryAccess'),
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      require('../middleware/fetchTemplate'),
      formio.middleware.checkStageProject,
      formio.middleware.checkTenantProjectPlan,
      formio.middleware.projectDefaultPlan,
      formio.middleware.projectEnvCreatePlan,
      formio.middleware.projectEnvCreateAccess,
      formio.middleware.licenseUtilization,
      (req, res, next) => {
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
      (req, res, next) => {
        if (_.get(req.headers, 'x-remote-token')) {
          _.set(req.body, 'settings.remoteStage', true);
        }
        next();
      },
      formio.middleware.bootstrapEntityOwner,
      formio.middleware.projectTeamSync,
      formio.middleware.condensePermissionTypes,
      formio.middleware.projectPlanFilter,
    ],
    afterPost: [
      formio.middleware.postCreateLicenseCheck,
      require('../middleware/projectTemplate')(formio, router),
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.projectUsage,
      formio.middleware.syncProjectUsage,
      projectSettings,
      formio.middleware.customCrmAction('newproject'),
      require('../middleware/projectCreatePdfInfo'),
    ],
    beforeIndex: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.projectIndexFilter,
    ],
    afterIndex: [
      formio.middleware.licenseUtilization,
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.projectUsage,
      formio.middleware.syncProjectUsage,
      projectSettings,
    ],
    beforePut: [
      formio.middleware.checkRequestAllowed,
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.licenseUtilization,
      (req, res, next) => {
        if (req.body._id) {
          return next();
        }
        if (req.body._id && (req.body._id !== req.projectId)) {
          return res.status(400).send('Project ID is different from the project body ID.');
        }
        return next();
      },
      function(req, res, next) {
        // Always keep the licenseKey even if they don't send it.
        const licenseKey = _.get(req.body, 'settings.licenseKey');
        if (licenseKey==='') {
          delete req.body.settings.licenseKey;
        }
        if (req.body.settings && !licenseKey && _.get(req.currentProject, 'settings.licenseKey', false)) {
          _.set(req.body, 'settings.licenseKey', _.get(req.currentProject, 'settings.licenseKey'));
        }
        return next();
      },
      (req, res, next) => {
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
      (req, res, next) => {
        // Don't allow some changes if project is protected.
        if ('protect' in req.currentProject && req.currentProject.protect === true && req.body.protect !== false) {
          const accesses = {};
          req.currentProject.access.forEach(access => {
            accesses[access.type] = access.roles;
          });
          req.body.name = req.currentProject.name;
          req.body.access = req.body.access || [];
          req.body.access.forEach(access => {
            if (['read_all', 'create_all', 'update_all', 'delete_all'].includes(access.type)) {
              access.roles = _.map(accesses[access.type], role => role.toString());
              delete accesses[access.type];
            }
            if (['team_access', 'team_admin', 'team_write', 'team_read'].includes(access.type)) {
              delete accesses[access.type];
            }
          });
          Object.keys(accesses).forEach((key) => {
            const access = _.find(req.body.access, {type: key});
            const newAccess = _.map(accesses[key], role => role.toString());
            if (!access) {
              req.body.access.push({
                type: key,
                roles: newAccess,
              });
            }
            else {
              access.roles = _.uniq(access.roles.concat(newAccess));
            }
          });

          req.body.access = _.uniqBy(req.body.access, 'type');
        }

        if (!req.body.name && req.body.name !== '') {
          req.body.name = req.currentProject.name;
        }

        // Reset the machine name so that it will regenerate.
        if (req.body.name !== req.currentProject.name) {
          req.body.machineName = '';
        }

        // forbid changing CORS settings for tenants.
        if (req.body.type === 'tenant' && req.body.settings.cors) {
          delete req.body.settings.cors;
        }

        next();
      },
      // Don't allow modifying a primary project id.
      (req, res, next) => {
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
      projectSettings,
    ],
    afterPut: [
      require('../middleware/projectTemplate')(formio, router),
      formio.middleware.filterResourcejsResponse(hiddenFields),
      projectSettings,
      formio.middleware.customCrmAction('updateproject'),
      (req, res, next) => {
        formio.cache.updateProjectCache(res.resource.item);
        next();
      },
      (req, res, next) => {
        /* eslint-disable callback-return */
        next();
        /* eslint-enable callback-return */

        // If the name changed, then re-save all forms, actions, and roles to set the new project name
        if (res.resource && res.resource.item && res.resource.item.name !== req.currentProject.name) {
          let parts = [];
          formio.resources.form.model.find({
            deleted: {$eq: null},
            project: formio.util.idToBson(req.currentProject._id),
          }).then((forms) => forms.forEach((form) => {
            parts = form.machineName.split(':');
            if (parts.length === 2) {
              form.machineName = `${res.resource.item.name}:${parts[1]}`;
              formio.resources.form.model.updateOne({
                _id: form._id
              },
              {$set: form});
            }

            formio.resources.actionItem.model.find({
              deleted: {$eq: null},
              form: form._id,
            }).then((actions) => actions.forEach((action) => {
              parts = action.machineName.split(':');
              if (parts.length === 3) {
                action.machineName = `${res.resource.item.name}:${parts[1]}:${parts[2]}`;
                formio.resources.actionItem.model.updateOne({
                  _id: action._id
                },
                {$set: action});
              }
            }));
          }));

          // Update all roles.
          formio.resources.role.model.find({
            deleted: {$eq: null},
            project: formio.util.idToBson(req.currentProject._id),
          }).then((roles) => roles.forEach((role) => {
            parts = role.machineName.split(':');
            if (parts.length === 2) {
              role.machineName = `${res.resource.item.name}:${parts[1]}`;

              formio.resources.role.model.updateOne({
                _id: role._id
              },
              {$set: role});
            }
          }));
        }
      },
    ],
    beforeDelete: [
      formio.middleware.checkRequestAllowed,
      require('../middleware/projectProtectAccess')(formio),
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.licenseUtilization,
      require('../middleware/deleteProjectHandler')(formio),
    ],
    afterDelete: [
      (req, res, next) => {
        formio.cache.deleteProjectCache(req.currentProject);
        next();
      },
      formio.middleware.filterResourcejsResponse(hiddenFields),
      formio.middleware.customCrmAction('deleteproject'),
      projectSettings
    ],
  });

  router.post('/project/available', async (req, res, next) => {
    if (!req.body || !req.body.name) {
      return res.status(400).send('"name" parameter is required');
    }
    if (config.reservedSubdomains && _.includes(config.reservedSubdomains, req.body.name)) {
      return res.status(200).send({available: false});
    }

    try {
      const project = await resource.model.findOne({name: req.body.name, deleted: {$eq: null}});
      return res.status(200).json({available: !project});
    }
    catch (err) {
      debug(err);
      return next(err);
    }
  });

  const sqlconnector = require('../actions/sqlconnector/util')(formioServer);
  const sqlconnector2 = require('../actions/sqlconnector/util_v2')(formioServer);
  router.get(
    '/project/:projectId/sqlconnector',
    formio.middleware.tokenHandler,
    formio.middleware.restrictProjectAccess({level: 'admin'}),
    formio.middleware.restrictToPlans(['commercial', 'team', 'trial']),
    (req,res,next) => {
      if ( req.query.format === "v2") {
        return sqlconnector2.generateQueries(req,res,next);
      }
      return sqlconnector.generateQueries(req,res,next);
    },
  );
  router.get(
    '/project/:projectId/sqlconnector2',
    formio.middleware.tokenHandler,
    formio.middleware.restrictProjectAccess({level: 'admin'}),
    formio.middleware.restrictToPlans(['commercial', 'team', 'trial']),
    (req,res,next) => {
        return sqlconnector2.generateQueries(req,res,next);
    },
  );
  // The portal check endpoint
  router.post(
    '/project/:projectId/portal-check',
      cors(),
      formio.middleware.tokenHandler,
      async (req, res, next) => {
        const origin = req.header('Origin');
        if (
          !origin || (origin.includes('http://localhost:') ||
            origin.includes('http://portal.localhost:'))
          ) {
            return res.status(200).send('OK');
        }

        if (req.body && req.body.payload) {
          const hash = crypto.createHash('md5').update(origin).digest('hex');

          if (hash === req.body.payload && origin) {
            const domain = _.get(req.currentProject, 'settings.portalDomain');
            if (!domain || domain !== origin) {
              try {
                await formio.cache.updateCurrentProject(req, {
                  settings: {
                    portalDomain: origin
                  }
                });
                return res.status(200).send('OK');
            }
            catch (err) {
              return next(err);
            }
            }
            return res.status(200).send('OK');
          }
          else {
            res.status(400).send();
          }
        }
        else {
          res.status(400).send();
        }
      }
  );

  return resource;
};
