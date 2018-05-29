'use strict';

const CryptoJS = require('crypto-js');
const AWS = require('aws-sdk');

module.exports = function(router) {
  router.get('/project/:projectId/form/:formId/storage/s3',
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

        if (!project.settings.storage || !project.settings.storage.s3) {
          return res.status(400).send('Storage settings not set.');
        }
        const file = {
          bucket: req.query.bucket,
          key: req.query.key
        };
        const s3 = new AWS.S3({
          accessKeyId: project.settings.storage.s3.AWSAccessKeyId,
          secretAccessKey: project.settings.storage.s3.AWSSecretKey
        });
        s3.getSignedUrl('getObject', {
          Bucket: file.bucket,
          Key: file.key
        }, function(err, url) {
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

  router.post('/project/:projectId/form/:formId/storage/s3',
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

        if (!project.settings.storage || !project.settings.storage.s3) {
          return res.status(400).send('Storage settings not set.');
        }
        const file = req.body;
        const dir = project.settings.storage.s3.startsWith || '';
        const expirationSeconds = project.settings.storage.s3.expiration || (15 * 60);
        const expiration = new Date(Date.now() + (expirationSeconds * 1000));
        const policy = {
          expiration: expiration.toISOString(),
          conditions: [
            {'bucket': project.settings.storage.s3.bucket},
            ['starts-with', '$key', dir],
            {'acl': project.settings.storage.s3.acl || 'private'},
            ['starts-with', '$Content-Type', ''],
            ['starts-with', '$filename', ''],
            ['content-length-range', 0, project.settings.storage.s3.maxSize || (100 * 1024 * 1024)]
          ]
        };

        const response = {
          url: project.settings.storage.s3.bucketUrl || `https://${project.settings.storage.s3.bucket}.s3.amazonaws.com/`,
          bucket: project.settings.storage.s3.bucket,
          data: {
            key: dir,
            AWSAccessKeyId: project.settings.storage.s3.AWSAccessKeyId,
            acl: project.settings.storage.s3.acl || 'private',
            policy: new Buffer(JSON.stringify(policy)).toString('base64'),
            'Content-Type': file.type,
            filename: file.name
          }
        };

        /* eslint-disable new-cap */
        response.data.signature = CryptoJS.HmacSHA1(
          response.data.policy,
          project.settings.storage.s3.AWSSecretKey
        ).toString(CryptoJS.enc.Base64);

        /* eslint-enable new-cap */
        return res.send(response);
      });
    }
  );
};
