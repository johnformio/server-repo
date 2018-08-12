'use strict';
const AWS = require('aws-sdk');
const getAWS = function(project) {
  const config = {
    accessKeyId: project.settings.storage.s3.AWSAccessKeyId,
    secretAccessKey: project.settings.storage.s3.AWSSecretKey
  };
  if (project.settings.storage.s3.region) {
    config.region = project.settings.storage.s3.region;
  }
  if (project.settings.storage.s3.encryption) {
    config.signatureVersion = 'v4';
  }

  // Return the AWS.S3 object.
  return new AWS.S3(config);
};
module.exports = {
  getUrl(req, project, next) {
    getAWS(project).getSignedUrl('getObject', {
      Bucket: req.query.bucket,
      Key: req.query.key
    }, next);
  },
  putUrl(project, file, next) {
    // If they have encryption or the region provided, then this will create a signed url.
    if (
      (project.settings.storage.s3.encryption || project.settings.storage.s3.region) &&
      project.settings.storage.s3.bucket
    ) {
      const putConfig = {
        Bucket: project.settings.storage.s3.bucket,
        Key: file.path,
        ContentType: file.type,
        Expires: file.expiresin,
        ACL: project.settings.storage.s3.acl || 'private'
      };
      switch (project.settings.storage.s3.encryption) {
        case 'aes':
          putConfig.ServerSideEncryption = 'AES256';
          break;
        case 'kms':
          putConfig.ServerSideEncryption = 'aws:kms';
          break;
      }
      if (
        (project.settings.storage.s3.encryption === 'kms') &&
        project.settings.storage.s3.kmsKey
      ) {
        putConfig.SSEKMSKeyId = project.settings.storage.s3.kmsKey;
      }
      return getAWS(project).getSignedUrl('putObject', putConfig, next);
    }
    else {
      // Use the legacy manually signed upload url.
      return next();
    }
  }
};
