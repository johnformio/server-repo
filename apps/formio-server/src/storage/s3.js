'use strict';
const aws = require('./s3/aws');
const minio = require('./s3/minio');
const CryptoJS = require('crypto-js');
const _ = require('lodash');
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

        if (project.settings.storage.s3.minio) {
          minio.getUrl(req, project, (err, url) => {
            if (err) {
              return res.status(400).send(err);
            }
            res.send({url});
          });
        }
        else {
          aws.getUrl(req, project, (err, url) => {
            if (err) {
              return res.status(400).send(err);
            }
            res.send({url});
          });
        }
      });
    }
  );

  const uploadResponse = function(project, file, signedUrl) {
    const response = {
      signed: signedUrl,
      minio: project.settings.storage.s3.minio,
      url: project.settings.storage.s3.bucketUrl || `https://${project.settings.storage.s3.bucket}.s3.amazonaws.com`,
      bucket: project.settings.storage.s3.bucket
    };

    const policy = new Buffer(JSON.stringify({
      expiration: file.expiration,
      conditions: [
        {'bucket': project.settings.storage.s3.bucket},
        ['starts-with', '$key', file.dir],
        {'acl': project.settings.storage.s3.acl || 'private'},
        ['starts-with', '$Content-Type', ''],
        ['starts-with', '$filename', ''],
        ['content-length-range', 0, project.settings.storage.s3.maxSize || (100 * 1024 * 1024)]
      ]
    })).toString('base64');

    /* eslint-disable new-cap */
    response.data = {
      key: file.dir,
      signature: CryptoJS.HmacSHA1(
        policy,
        project.settings.storage.s3.AWSSecretKey
      ).toString(CryptoJS.enc.Base64),
      AWSAccessKeyId: project.settings.storage.s3.AWSAccessKeyId,
      acl: project.settings.storage.s3.acl || 'private',
      policy: policy,
      'Content-Type': file.type,
      filename: file.name
    };
    /* eslint-enable new-cap */

    // Return the response to the client.
    return response;
  };

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

        const file = req.body || {};
        file.dir = project.settings.storage.s3.startsWith || '';
        file.expiresin = parseInt(project.settings.storage.s3.expiration || (15 * 60), 10);
        file.expiration = (new Date(Date.now() + (file.expiresin * 1000))).toString();
        file.path = _.trim(`${_.trim(file.dir, '/')}/${_.trim(file.name, '/')}`, '/');
        if (project.settings.storage.s3.minio) {
          minio.putUrl(project, file, (err, signedUrl) => {
            if (err) {
              return res.status(400).send(err);
            }
            res.send(uploadResponse(project, file, signedUrl));
          });
        }
        else {
          aws.putUrl(project, file, (err, signedUrl) => {
            if (err) {
              return res.status(400).send(err);
            }
            res.send(uploadResponse(project, file, signedUrl));
          });
        }
      });
    }
  );
};
