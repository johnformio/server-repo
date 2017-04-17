'use strict';

var Resource = require('resourcejs');
var _ = require('lodash');
var debug = require('debug')('formio:resources:version');

module.exports = function(router, formioServer) {
  var formio = formioServer.formio;
  var cache = require('../cache/cache')(formio);
  formio.middleware.versionHandler = require('../middleware/versionHandler')(router);
  formio.middleware.restrictToPlans = require('../middleware/restrictToPlans')(router);

  var hiddenFields = ['deleted', '__v'];

  var resource = Resource(
    router,
    '/project/:projectId',
    'version',
    formio.mongoose.model('version', formio.schemas.version)
  ).rest({
    beforeGet: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.versionHandler
    ],
    afterGet: [
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ],
    beforePost: [
      formio.middleware.restrictToPlans(['team', 'commercial', 'trial']),
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.versionHandler,
      function(req, res, next) {
        cache.loadCurrentProject(req, (err, project) => {
          formio.template.export({projectId: project.project}, function(err, template) {
            if (err) {
              return res.status(400).send(err);
            }
            template.version = req.body.version;
            template.title = project.title;
            template.name = project.name;
            template.description = project.description;
            req.body.template = template;
            req.body.owner = project.owner.toString();
            return next();
          });
        });
      }
    ],
    afterPost: [
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ],
    beforePut: [
      function(req, res, next) {
        return res.status(400).send('Modifying versions not allowed.');
      }
    ],
    beforeDelete: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.versionHandler
    ],
    beforeIndex: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.versionHandler
    ],
    afterIndex: [
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ]
  });

  /**
   * Expose the project current version via api.
   *
   * @type {{loadProjectByName, currentProject, loadCurrentProject, loadPrimaryProject, loadProject}|*}
   */
  router.get(
    '/project/:projectId/version/current',
    function(req, res, next) {
      cache.loadCurrentProject(req, (err, project) => {
        if (err) {
          return res.status(400).send(err);
        }
        return res.send(project.version);
      });
    }
  );

  /**
   * Create a deploy endpoint.
   */
  router.post(
    '/project/:projectId/deploy',
    formio.middleware.restrictToPlans(['team', 'commercial', 'trial']),
    function(req, res, next) {
      cache.loadCurrentProject(req, (err, project) => {
        const deploy = req.body;
        deploy.project = project._id;

        // Sanity checks.
        if (!('type' in deploy)) {
          return res.status(400).send('Deploy command must contain a type.');
        }

        switch (deploy.type) {
          case 'version': {
            if (!('version' in deploy)) {
              return res.status(400).send('Deploy version command must contain a version number.');
            }
            const search = {
              version: deploy.version,
              project: project,
              deleted: {$eq: null}
            };
            formio.mongoose.model('version').findOne(search).exec((err, result) => {
              if (err) {
                return res.status(400).send(err);
              }
              let template = result.template;

              template = _.assign({}, template, project);
              debug('import template', template);

              //let alters = hook.alter('templateAlters', {});
              //
              //formio.template.import.template(template, alters, function(err, template) {
              //  if (err) {
              //    _debug(err);
              //    return res.status(400).send('An error occurred with the template import.');
              //  }
              //
              //  return res.send('Version Deployed');
              //
              //  if (req.templateMode === 'create') {
              //    // Update the project with this template.
              //    //return updateProject(template);
              //  }
              //});
            });
            break;
          }
          case 'environment': {
            if (!('environment' in deploy)) {
              return res.status(400).send('Deploy environment command must contain an environment name.');
            }
            // TODO: do environment deploy.
            break;
          }
          default: {
            return res.status(400).send('Unknown deploy type. Please use version or environment.');
          }
        }
      });
    }
  );

  return resource;
};
