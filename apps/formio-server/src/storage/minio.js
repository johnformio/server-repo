'use strict';
const Minio = require('minio');

module.exports = function(router) {
  router.get('/project/:projectId/form/:formId/storage/minio',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    router.formio.formio.middleware.permissionHandler,
    router.formio.formio.plans.disableForPlans(['basic', 'independent']),
    function(req, res) {
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        if (!project.settings.storage || !project.settings.storage.minio) {
          return res.status(400).send('Storage settings not set.');
        }

        const client = new Minio.Client({
          endPoint: project.settings.storage.minio.endpoint,
          port: project.settings.storage.minio.port,
          secure: project.settings.storage.minio.secure.toString() === 'true',
          accessKey: project.settings.storage.minio.key,
          secretKey: project.settings.storage.minio.secret
        });

        client.presignedGetObject(req.query.bucket, req.query.key, 24*60*60, function(err, url) {
          if (err) {
            return res.status(400).send(err);
          }
          res.send({
            url: url
          });
        });
      });
    }
  );

  router.post('/project/:projectId/form/:formId/storage/minio',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    router.formio.formio.middleware.permissionHandler,
    router.formio.formio.plans.disableForPlans(['basic', 'independent']),
    function(req, res) {
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        if (!project.settings.storage || !project.settings.storage.minio) {
          return res.status(400).send('Storage settings not set.');
        }

        const file = req.body;
        const client = new Minio.Client({
          endPoint: project.settings.storage.minio.endpoint,
          port: project.settings.storage.minio.port,
          secure: project.settings.storage.minio.secure.toString() === 'true',
          accessKey: project.settings.storage.minio.key,
          secretKey: project.settings.storage.minio.secret
        });

        client.presignedPutObject(
          project.settings.storage.minio.bucket,
          file.name,
          (project.settings.storage.minio.expiration * 60),
          (err, url) => {
            if (err) {
              return res.status(400).send(err);
            }
            res.send({
              url: url
            });
          }
        );
      });
    }
  );
};
