'use strict';

const CryptoJS = require('crypto-js');
const AWS = require('aws-sdk');
const Minio = require('minio');

const s3Storage = {
  getUrl(req, project, next) {
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
        return next(err);
      }
      next(null, {
        url: url
      });
    });
  },
  putUrl(project, file, next) {
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

    // If they use a bucket url like for Minio.
    if (
      project.settings.storage.s3.bucketUrl &&
      (project.settings.storage.s3.bucketUrl.indexOf('s3.amazonaws.com') === -1)
    ) {
      response.url = project.settings.storage.s3.bucketUrl;
      /* eslint-disable new-cap */
      response.data.signature = CryptoJS.HmacSHA1(
        response.data.policy,
        project.settings.storage.s3.AWSSecretKey
      ).toString(CryptoJS.enc.Base64);
      /* eslint-enable new-cap */
      return next(null, response);
    }
    else if (project.settings.storage.s3.bucket) {
      // This is an S3 upload
      const s3 = new AWS.S3({
        accessKeyId: project.settings.storage.s3.AWSAccessKeyId,
        secretAccessKey: project.settings.storage.s3.AWSSecretKey
      });
      const putConfig = {
        Bucket: project.settings.storage.s3.bucket,
        Key: `${dir}/${file.name}`,
        Expires: policy.expiration
      };
      if (file.encrypt) {
        putConfig.ServerSideEncryption = file.encrypt;
      }
      s3.getSignedUrl('putObject', putConfig, function(err, url) {
        if (err) {
          return next(err);
        }
        response.url = url;
        next(null, response);
      });
    }
    else {
      return next('No configured bucket.');
    }
  }
};

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

        s3Storage.getUrl(req, project, (err, response) => {
          if (err) {
            return res.status(400).send(err);
          }
          res.send(response);
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
        s3Storage.putUrl(project, file, (err, response) => {
          if (err) {
            return res.status(400).send(err);
          }
          res.send(response);
        });
      });
    }
  );
};
