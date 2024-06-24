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
      formio.middleware.checkRequestAllowed,
      formio.middleware.restrictToPlans(['commercial', 'trial']),
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.tagHandler,
      async function(req, res, next) {
          const project = await formio.cache.loadCurrentProject(req);
          // Allow passing template from frontend. This is useful for remote environments.
          if (!req.body.template) {
            const options = await router.formio.formio.hook.alter('exportOptions', {}, req, res);
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
      },
      function(req, res, next) {
        const template = {};
        template.forms = req.body.template.forms;
        template.resources = req.body.template.resources;
        template.actions = req.body.template.actions;
        template.revisions = req.body.template.revisions;
        req.templateData = template;

        req.body.template.access = [];
        delete req.body.template.forms;
        delete req.body.template.resources;
        delete req.body.template.actions;
        delete req.body.template.revisions;
        next();
      }
    ],
    afterPost: [
      formio.middleware.createTagChunks,
      formio.middleware.getFullTagTemplate,
      async function(req, res, next) {
        try {
          await formio.cache.updateCurrentProject(req, {
            tag: req.body.tag
          });
          return next();
        }
        catch (err) {
          return next(err);
        }
      },
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ],
    beforePut: [
      function(req, res, next) {
        return res.status(400).send('Modifying tags not allowed.');
      }
    ],
    beforeDelete: [
      formio.middleware.checkRequestAllowed,
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.deleteTagHandler
    ],
    beforeIndex: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      function(req, res, next) {
        const query = hook.alter('rawDataAccess', req, next) ? {} : {chunk: {$ne: true}};

        req.modelQuery = req.modelQuery || req.model || this.model;
        req.modelQuery = req.modelQuery.find(query);

        req.countQuery = req.countQuery || req.model || this.model;
        req.countQuery = req.countQuery.find(query);

        next();
      },
      formio.middleware.tagHandler,
      (req, res, next) => {
        // Remove tag contents to speed up index requests.
        if (!req.query.full && !hook.alter('rawDataAccess', req, next)) {
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
    async function(req, res, next) {
      try {
        const project = await formio.cache.loadCurrentProject(req);
        return res.send({tag: project.tag});
      }
      catch (err) {
        return res.status(400).send(err);
      }
    }
  );

  /**
   * Create a deploy endpoint.
   */
  router.post(
    '/project/:projectId/deploy',
    formio.middleware.checkRequestAllowed,
    formio.middleware.restrictToPlans(['commercial', 'trial']),
    async function(req, res, next) {
        const project = await formio.cache.loadCurrentProject(req);
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
              project: router.formio.formio.util.idToBson(project.project || project._id),
              deleted: {$eq: null}
            };
            try {
              const tags = await formio.mongoose.model('tag').find(search).exec();
              if (tags.length===0) {
                return res.status(400).send('Tag not found.');
              }

              const template = _.merge(...tags.map(tag=>tag.template));

              Object.assign(template, _.pick(project, ['name', 'title', 'description', 'machineName']));
              const alters = hook.alter('templateAlters', {});

              formio.template.import.template(template, alters, async function(err, template) {
                if (err) {
                  debug(err);
                  return res.status(400).send(err);
                }

                await formio.cache.updateCurrentProject(req, {
                  tag: tags[0].tag,
                  lastDeploy: Date.now()
                });
                  return res.send('Tag Deployed');
              });
            }
            catch (err) {
              return res.status(400).send(err);
            }
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
            template.access = [];

            Object.assign(template, _.pick(project, ['name', 'title', 'description', 'machineName']));
            const alters = hook.alter('templateAlters', {});

            formio.template.import.template(template, alters, async function(err, template) {
              if (err) {
                debug(err);
                return res.status(400).send(err);
              }

              router.formio.formio.log('Deploy Template', req, template.tag);
              try {
                await formio.cache.updateCurrentProject(req, {
                  tag: template.tag,
                  lastDeploy: Date.now()
                });
                return res.send('Tag Deployed');
              }
              catch (err) {
                return res.status(400).send(err.message || err);
              }
            });

            break;
          }
          default: {
            return res.status(400).send('Unknown deploy type. Please use tag or environment.');
          }
        }
    }
  );

  return resource;
};
