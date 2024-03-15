/* eslint-disable new-cap */
'use strict';
const _ = require('lodash');
const CryptoJS = require('crypto-js');

const {getMinioPresignedGetUrl, getMinioPresignedPutUrl, removeMinioObject} = require('./minio');
const {
  getAWSPresignedGetUrl,
  getAWSPresignedPutUrl,
  getAWSPresignedMultipartUrls,
  completeAWSMultipartUpload,
  abortAWSMultipartUpload,
  removeAWSObject,
} = require('./aws');
const debug = {
  startup: require('debug')('formio:startup'),
  s3: require('debug')('formio:s3')
};

const {MB_IN_BYTES} = require('./constants');

function getS3Settings(project) {
  if (!project.settings.storage || !project.settings.storage.s3) {
    throw new Error('Storage settings not set.');
  }
  return project.settings.storage.s3;
}

function getPresignedGetUrl(s3Settings, bucket, key) {
  if (s3Settings.minio) {
    return getMinioPresignedGetUrl(s3Settings, bucket, key);
  }
  return getAWSPresignedGetUrl(s3Settings, bucket, key);
}

async function getEmailFileUrl(project, file) {
  if (!file?.bucket || !file?.key) {
    throw new Error('File not provided.');
  }

  const s3Settings = getS3Settings(project);
  return s3Settings.minio
    ? await getMinioPresignedGetUrl(s3Settings, file.bucket, file.key)
    : await getAWSPresignedGetUrl(s3Settings, file.bucket, file.key);
}

function removeFile(s3Settings, bucket, key) {
  if (s3Settings.minio) {
    return removeMinioObject(s3Settings, bucket, key);
  }

  return removeAWSObject(s3Settings, bucket, key);
}

function getPresignedMultipartUrls(s3Settings, file) {
  if (s3Settings.minio) {
    throw new Error('Multipart uploads via minio are not yet supported.');
  }
  return getAWSPresignedMultipartUrls(s3Settings, file);
}

function completeMultipartUpload(s3Settings, payload) {
  if (s3Settings.minio) {
    throw new Error('Multipart uploads via minio are not yet supported');
  }
  return completeAWSMultipartUpload(s3Settings, payload);
}

function abortMultipartUpload(s3Settings, payload) {
  if (s3Settings.minio) {
    throw new Error('Multipart uploads via minio are not yet supported');
  }
  return abortAWSMultipartUpload(s3Settings, payload);
}

function getPresignedPutUrl(s3Settings, file) {
  if (s3Settings.minio) {
    return getMinioPresignedPutUrl(s3Settings, file);
  }
  return getAWSPresignedPutUrl(s3Settings, file);
}

function getUploadResponse(s3Settings, file, signedUrl, headers, uploadId, partSizeActual) {
  try {
    const bucketUrl = s3Settings.bucketUrl || `https://${s3Settings.bucket}.s3.amazonaws.com`;

    const response = {
      signed: signedUrl,
      minio: s3Settings.minio,
      url: bucketUrl,
      bucket: s3Settings.bucket,
      uploadId,
      key: file.path,
      partSizeActual
    };

    const policy = Buffer.from(JSON.stringify({
      expiration: file.expiration,
      conditions: [
        {'bucket': s3Settings.bucket},
        ['starts-with', '$key', file.dir],
        {'acl': s3Settings.acl || 'private'},
        ['starts-with', '$Content-Type', ''],
        ['starts-with', '$filename', ''],
        ['content-length-range', 0, s3Settings.maxSize || (100 * 1024 * 1024)]
      ]
    })).toString('base64');

    response.data = {
      key: file.dir,
      acl: s3Settings.acl || 'private',
      policy,
      'Content-Type': file.type,
      filename: file.name,
      headers,
    };

    if (s3Settings.AWSSecretKey) {
      response.data.signature = CryptoJS.HmacSHA1(
        policy,
        s3Settings.AWSSecretKey
      ).toString(CryptoJS.enc.Base64);
    }

    if (s3Settings.AWSAccessKeyId) {
      response.data.AWSAccessKeyId = s3Settings.AWSAccessKeyId;
    }

    // Return the response to the client.
    return response;
  }
  catch (err) {
    debug.s3(err);
    throw new Error('Failed to get upload response');
  }
}

const middleware = function(router) {
  function loadProject(req) {
    return new Promise((resolve, reject) => {
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return reject('Project not found.');
        }
        resolve(project);
      });
    });
  }

  const beforeFileUpload = [
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
  ];

  const beforeFileDelete = [
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
  ];

  debug.startup('Attaching middleware: S3 storage GET');
  router.get('/project/:projectId/form/:formId/storage/s3',
    ...beforeFileUpload,
    async function(req, res) {
      try {
        const project = await loadProject(req);
        const s3Settings = getS3Settings(project);
        if (!req.query.bucket || !req.query.key) {
          throw new Error('Need both bucket and key to GET file from S3');
        }
        const url = await getPresignedGetUrl(s3Settings, req.query.bucket, req.query.key);
        return res.send({url});
      }
      catch (err) {
        return res.status(400).send(err.message || err);
      }
    }
  );

  debug.startup('Attaching middleware: S3 storage POST');
  router.post('/project/:projectId/form/:formId/storage/s3',
    ...beforeFileUpload,
    async function(req, res) {
      try {
        const project = await loadProject(req);
        const s3Settings = getS3Settings(project);

        const file = req.body || {};
        if (file.multipart && !file.multipart.partSize) {
          throw new Error('Part size is required for multipart uploads');
        }
        file.dir = s3Settings.startsWith || '';
        file.expiresin = parseInt(s3Settings.expiration || (file.multipart ? 3600 : 900));
        file.expiration = (new Date(Date.now() + (file.expiresin * 1000))).toISOString();
        file.path = _.trim(`${_.trim(file.dir, '/')}/${_.trim(file.name, '/')}`, '/');

        if (file.multipart && file.size > 10 * MB_IN_BYTES) {
          const {urls, headers, uploadId, partSizeActual} = await getPresignedMultipartUrls(s3Settings, file);
          return res.send(getUploadResponse(s3Settings, file, urls, headers, uploadId, partSizeActual));
        }
        const {url, headers} = await getPresignedPutUrl(s3Settings, file);
        return res.send(getUploadResponse(s3Settings, file, url, headers));
      }
      catch (err) {
        return res.status(400).send(err.message || err);
      }
    }
  );

  router.post('/project/:projectId/form/:formId/storage/s3/multipart/complete',
    ...beforeFileUpload,
    async function(req, res) {
      try {
        const project = await loadProject(req);
        const s3Settings = getS3Settings(project);

        if (!req.body.uploadId) {
          throw new Error('Upload ID is required to complete a multipart upload');
        }
        if (!req.body.parts?.length) {
          throw new Error('Part and ETag numbers are required to complete a multipart upload');
        }
        if (!req.body.key) {
          throw new Error('File key is required to complete a multipart upload');
        }

        const payload = req.body;
        const response = await completeMultipartUpload(s3Settings, payload);
        res.json(response);
      }
      catch (err) {
        return res.status(400).send(err.message || err);
      }
    }
  );

  router.post('/project/:projectId/form/:formId/storage/s3/multipart/abort',
    ...beforeFileUpload,
    async function(req, res) {
      try {
        const project = await loadProject(req);
        const s3Settings = getS3Settings(project);

        if (!req.body.uploadId) {
          throw new Error('Upload ID is required to abort a multipart upload');
        }
        if (!req.body.key) {
          throw new Error('File key is required to abort a multipart upload');
        }

        const payload = req.body;
        const response = await abortMultipartUpload(s3Settings, payload);
        res.json(response);
      }
      catch (err) {
        return res.status(400).send(err.message || err);
      }
    }
  );

  router.delete('/project/:projectId/form/:formId/storage/s3',
    ...beforeFileDelete,
    async function(req, res) {
      try {
        const project = await loadProject(req);
        const s3Settings = getS3Settings(project);

        if (!req.query.bucket || !req.query.key) {
          throw new Error('Need both bucket and key to GET file from S3');
        }

        const key = _.get(req, 'query.key') || req.fileName;
        await removeFile(s3Settings, req.query.bucket, key);
        return res.sendStatus(200);
      }
      catch (err) {
        return res.status(400).send(err.message || err);
      }
    }
  );
};

module.exports = {
  middleware,
  getEmailFileUrl,
};
