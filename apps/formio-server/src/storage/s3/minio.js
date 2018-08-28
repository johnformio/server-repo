'use strict';
const Minio = require('minio');
const url = require('url');
const getMinio = function(project) {
  const parsed = url.parse(project.settings.storage.s3.bucketUrl);
  const useSSL = (parsed.protocol.indexOf('https') === 0);
  const client = new Minio.Client({
    endPoint: parsed.hostname,
    port: parseInt(parsed.port, 10) || 9000,
    useSSL: useSSL,
    accessKey: project.settings.storage.s3.AWSAccessKeyId,
    secretKey: project.settings.storage.s3.AWSSecretKey
  });
  if (useSSL) {
    // Make sure we allow unauthorized certs.
    client.reqOptions.rejectUnauthorized = false;
  }
  return client;
};
module.exports = {
  getUrl(req, project, next) {
    getMinio(project).presignedGetObject(
      req.query.bucket,
      req.query.key,
      24*60*60,
      next
    );
  },
  putUrl(project, file, next) {
    getMinio(project).presignedPutObject(
      project.settings.storage.s3.bucket,
      file.path,
      file.expiresin,
      next
    );
  }
};
