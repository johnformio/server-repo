'use strict';
const AWS = require('aws-sdk');
const getAWS = function(project) {
  return new AWS.S3({
    accessKeyId: project.settings.storage.s3.AWSAccessKeyId,
    secretAccessKey: project.settings.storage.s3.AWSSecretKey
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
        Key: `${file.dir}/${file.name}`,
        Expires: file.expiration
      };
      if (file.encrypt) {
        putConfig.ServerSideEncryption = file.encrypt;
      }
      getAWS(project).getSignedUrl('putObject', putConfig, next);
    }
    else {
      return next('No configured bucket.');
    }
  }
};
