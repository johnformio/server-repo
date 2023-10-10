'use strict';
const aws = require('./s3/aws');
const minio = require('./s3/minio');
const CryptoJS = require('crypto-js');
const _ = require('lodash');
const debug = {
  startup: require('debug')('formio:startup')
};

async function getUrl(options = {}) {
  // Allow options.project as an alternative to options.settings
  if (options.project && !options.settings) {
    options.settings = _.get(options.project, 'settings.storage.s3');
  }

  if (!options.settings) {
    throw new Error('Storage settings not set.');
  }

  options.bucket = options.bucket || _.get(options, 'file.bucket');
  options.key    = options.key    || _.get(options, 'file.key');

  const _getUrl = options.settings.minio ? minio : aws;
  const url = await _getUrl(options);

  return url || options.settings.bucketUrl;
}

const middleware = function(router) {
  debug.startup('Attaching middleware: S3 storage GET');
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
    router.formio.formio.plans.disableForPlans(['basic', 'independent', 'archived']),
    function(req, res) {
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        getUrl({project, bucket: req.query.bucket, key: req.query.key}).then(
          url => res.send({url}),
          err => res.status(400).send(err.message));
      });
    }
  );

  router.delete('/project/:projectId/form/:formId/storage/s3',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (req.params.fileName) {
        req.fileName = req.params.fileName;
      }

      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    router.formio.formio.middleware.permissionHandler,
    router.formio.formio.plans.disableForPlans(['basic', 'independent', 'archived']),
    function(req, res) {
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        var key = _.get(req, 'query.key') || req.fileName;

        getUrl({project, bucket: req.query.bucket, key, method: 'DELETE'}).then(
          url => res.send({url}),
          err => res.status(400).json(err.message || 'File Delete Error.'));
      });
    }
  );

  const uploadResponse = function(project, file, presigned) {
    const bucketUrl = project.settings.storage.s3.bucketUrl || `https://${project.settings.storage.s3.bucket}.s3.amazonaws.com`;
    const url = typeof presigned === 'string' ? presigned : presigned.url;
    const response = {
      signed: url !== bucketUrl ? url : null,
      minio: project.settings.storage.s3.minio,
      url: bucketUrl,
      bucket: project.settings.storage.s3.bucket
    };

    /* eslint-disable new-cap */
    const policy = new Buffer.from(JSON.stringify({
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
    /* eslint-enable new-cap */

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
      filename: file.name,
      headers: presigned.headers
    };
    /* eslint-enable new-cap */

    // Return the response to the client.
    return response;
  };

  debug.startup('Attaching middleware: S3 storage POST');
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
    router.formio.formio.plans.disableForPlans(['basic', 'independent', 'archived']),
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
        file.expiration = (new Date(Date.now() + (file.expiresin * 1000))).toISOString();
        file.path = _.trim(`${_.trim(file.dir, '/')}/${_.trim(file.name, '/')}`, '/');

        getUrl({project, method: 'PUT', file}).then(
          result => res.send(uploadResponse(project, file, result)),
          err => res.status(400).send(err.message));
      });
    }
  );
};

module.exports = {
  middleware,
  getUrl
};
