'use strict';
const AWS = require('aws-sdk');
const getAWS = function(project) {
  return new AWS.S3({
    accessKeyId: project.settings.storage.s3.AWSAccessKeyId,
    secretAccessKey: project.settings.storage.s3.AWSSecretKey,
    region: project.settings.storage.s3.region || 'us-east-1',
    signatureVersion: 'v4'
  });
};
module.exports = {
  getUrl(req, project, next) {
    getAWS(project).getSignedUrl('getObject', {
      Bucket: req.query.bucket,
      Key: req.query.key
    }, next);
  },
  putUrl(project, file, next) {
    // If they use a bucket url, then perform manual signature.
    if (
      project.settings.storage.s3.bucketUrl &&
      (project.settings.storage.s3.bucketUrl.indexOf('s3.amazonaws.com') === -1)
    ) {
      return next();
    }
    // This is an AWS-S3 upload
    else if (project.settings.storage.s3.bucket) {
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
      getAWS(project).getSignedUrl('putObject', putConfig, next);
    }
    else {
      return next('No configured bucket.');
    }
  }
};
