'use strict';

const Resource = require('resourcejs');
const _ = require('lodash');
const debug = require('debug')('formio:resources:tag');

module.exports = function(router, formioServer) {
  const formio = formioServer.formio;
  const hook = require('formio/src/util/hook')(formio);
  formio.middleware.tagHandler = require('../middleware/tagHandler')(router);
  formio.middleware.restrictToPlans = require('../middleware/restrictToPlans')(router);
  formio.middleware.deleteTagHandler = require('../middleware/deleteTagHandler')(router, formioServer);
  formio.middleware.createTagChunks = require('../middleware/createTagChunks')(formio);
  formio.middleware.getFullTagTemplate = require('../middleware/getFullTagTemplate')(formio);

  const hiddenFields = ['deleted', '__v'];

  const resource = Resource(
    router,
    '/project/:projectId',
    'tag',
    formio.mongoose.model('tag')
  ).rest({
    beforeGet: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.tagHandler
    ],
    afterGet: [
      formio.middleware.getFullTagTemplate,
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ],
    beforePatch: [
      (req, res, next) => {
        return res.sendStatus(405);
      },
    ],
    beforePost: [
      formio.middleware.restrictToPlans(['commercial', 'trial']),
      formio.middleware.licenseUtilization,
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.tagHandler,
      function(req, res, next) {
        formio.cache.loadCurrentProject(req, (err, project) => {
          // Allow passing template from frontend. This is useful for remote environments.
          if (!req.body.template) {
            const options = router.formio.formio.hook.alter('exportOptions', {}, req, res);
            formio.template.export(options, function(err, template) {
              if (err) {
                return res.status(400).send(err);
              }
              template.tag = req.body.tag;
              req.body.template = template;
              req.body.owner = project.owner.toString();
              return next();
            });
          }
          else {
            req.body.template.tag = req.body.tag;
            req.body.owner = project.owner.toString();

            return next();
          }
        });
      },
      function(req, res, next) {
        const template = {};
        template.forms = req.body.template.forms;
        template.resources = req.body.template.resources;
        template.actions = req.body.template.actions;
        req.templateData = template;

        delete req.body.template.forms;
        delete req.body.template.resources;
        delete req.body.template.actions;
        next();
      }
    ],
    afterPost: [
      formio.middleware.createTagChunks,
      formio.middleware.getFullTagTemplate,
      function(req, res, next) {
        formio.cache.loadCurrentProject(req, (err, project) => {
          project.tag = req.body.tag;
          project.markModified('tag');
          project.save();
          return next();
        });
      },
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ],
    beforePut: [
      function(req, res, next) {
        return res.status(400).send('Modifying tags not allowed.');
      }
    ],
    beforeDelete: [
      formio.middleware.licenseUtilization,
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.deleteTagHandler
    ],
    beforeIndex: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      function(req, res, next) {
        req.modelQuery = req.modelQuery || req.model || this.model;
        req.modelQuery = req.modelQuery.find({chunk: {$ne: true}});

        req.countQuery = req.countQuery || req.model || this.model;
        req.countQuery = req.countQuery.find({chunk: {$ne: true}});

        next();
      },
      formio.middleware.tagHandler,
      (req, res, next) => {
        // Remove tag contents to speed up index requests.
        if (!req.query.full) {
          req.modelQuery.select({template: 0});
          req.countQuery.select({template: 0});
        }
        next();
      },
    ],
    afterIndex: [
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ]
  });

  /**
   * Expose the project current tag via api.
   *
   * @type {{loadProjectByName, currentProject, loadCurrentProject, loadPrimaryProject, loadProject}|*}
   */
  router.get(
    '/project/:projectId/tag/current',
    function(req, res, next) {
      formio.cache.loadCurrentProject(req, (err, project) => {
        if (err) {
          return res.status(400).send(err);
        }
        return res.send({tag: project.tag});
      });
    }
  );

  /**
   * Create a deploy endpoint.
   */
  router.post(
    '/project/:projectId/deploy',
    formio.middleware.restrictToPlans(['commercial', 'trial']),
    formio.middleware.licenseUtilization,
    function(req, res, next) {
      formio.mongoose.model('project').findOne({
        _id: req.projectId,
        deleted: {$eq: null}
      }).exec((err, project) => {
        const deploy = req.body;

        // Sanity checks.
        if (!('type' in deploy)) {
          return res.status(400).send('Deploy command must contain a type.');
        }

        switch (deploy.type) {
          case 'tag': {
            if (!('tag' in deploy)) {
              return res.status(400).send('Deploy tag command must contain a tag number.');
            }
            router.formio.formio.log('Deploy Tag', req, deploy.tag);
            const search = {
              tag: deploy.tag,
              project: project.project || project._id,
              deleted: {$eq: null}
            };
            formio.mongoose.model('tag').find(search).exec((err, tags) => {
              if (err) {
                return res.status(400).send(err);
              }
              if (tags.length===0) {
                return res.status(400).send('Tag not found.');
              }

              const template = _.merge(...tags.map(tag=>tag.template));

              Object.assign(template, _.pick(project, ['name', 'title', 'description', 'machineName']));
              const alters = hook.alter('templateAlters', {});

              formio.template.import.template(template, alters, function(err, template) {
                if (err) {
                  debug(err);
                  return res.status(400).send(err);
                }

                project.tag = tags[0].tag;
                project.markModified('tag');
                project.set('lastDeploy', Date.now());
                project.save((err) => {
                  if (err) {
                    return res.status(400).send(err.message || err);
                  }
                  return res.send('Tag Deployed');
                });
              });
            });
            break;
          }
          case 'environment': {
            if (!('environment' in deploy)) {
              return res.status(400).send('Deploy environment command must contain an environment name.');
            }
            res.status(400).send('Deploy environment not yet supported');
            // TODO: do environment deploy.
            break;
          }
          case 'template': {
            if (!('template' in deploy) || typeof deploy.template !== 'object') {
              return res.status(400).send('Must send a template with a template deployment.');
            }

            const template = deploy.template;

            Object.assign(template, _.pick(project, ['name', 'title', 'description', 'machineName']));
            const alters = hook.alter('templateAlters', {});

            formio.template.import.template(template, alters, function(err, template) {
              if (err) {
                debug(err);
                return res.status(400).send(err);
              }

              router.formio.formio.log('Deploy Template', req, template.tag);
              project.tag = template.tag;
              project.markModified('tag');
              project.set('lastDeploy', Date.now());
              project.save((err) => {
                if (err) {
                  return res.status(400).send(err.message || err);
                }
                return res.send('Tag Deployed');
              });
            });

            break;
          }
          default: {
            return res.status(400).send('Unknown deploy type. Please use tag or environment.');
          }
        }
      });
    }
  );

  return resource;
};
