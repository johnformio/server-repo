'use strict';

var Resource = require('resourcejs');
//var debug = require('debug')('formio:resources:version');

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
  ).get({
    before: [
      formio.middleware.restrictToPlans(['team', 'commercial', 'trial']),
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.versionHandler
    ],
    after: [
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ]
  })
  .post({
    before: [
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
    after: [
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ]
  })
  .index({
    before: [
      formio.middleware.restrictToPlans(['team', 'commercial', 'trial']),
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.versionHandler
    ],
    after: [
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
    formio.middleware.versionHandler,
    function(req, res, next) {
      // TODO: Do an import with the template from a version.
      return res.send('Deployed!');
    }
  );

  return resource;
};
