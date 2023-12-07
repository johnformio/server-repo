'use strict';
const Minio = require('minio');
const url = require('url');

const getMinio = function(settings = {}) {
  const parsed = url.parse(settings.bucketUrl);
  const useSSL = (parsed.protocol.indexOf('https') === 0);

  const config = {
    endPoint: parsed.hostname,
    useSSL: useSSL,
    accessKey: settings.AWSAccessKeyId,
    secretKey: settings.AWSSecretKey,
    port: parseInt(parsed.port, 10) || (useSSL ? 443 : 9000)
  };

  if (settings.region) {
    config.region = settings.region;
  }

  const client = new Minio.Client(config);

  if (useSSL) {
    // Make sure we allow unauthorized certs.
    client.reqOptions.rejectUnauthorized = false;
  }

  return client;
};

const getMinioPresignedPutUrl = function(s3Settings, file) {
  return new Promise((resolve, reject) => {
    const minio = getMinio(s3Settings);
    minio.presignedPutObject(
      s3Settings.bucket,
      file.path,
      file.expiresin,
      (err, result) => err ? reject(err) : resolve({url: result, headers: {}})
    );
  });
};

function getMinioPresignedGetUrl(s3Settings, bucket, key) {
  return new Promise((resolve, reject) => {
    const minio = getMinio(s3Settings);
    minio.presignedGetObject(
      bucket,
      key,
      24*60*60,
      (err, result) => err ? reject(err) : resolve(result)
    );
  });
}

function removeMinioObject(s3Settings, bucket, key) {
  return new Promise((resolve, reject) => {
    const minio = getMinio(s3Settings);
    minio.removeObject(
      bucket,
      key,
      {},
      (err, result) => err ? reject(err) : resolve(result)
    );
  });
}

module.exports = {getMinioPresignedPutUrl, getMinioPresignedGetUrl, removeMinioObject};
