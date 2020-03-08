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
    secretKey: settings.AWSSecretKey
  };

  if (!useSSL) {
    config.port = parseInt(parsed.port, 10) || 9000;
  }

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

const getUrl = function(options = {}) {
  return new Promise((resolve, reject) => {
    const minio = getMinio(options.settings);

    if (options.method === 'PUT') {
      minio.presignedPutObject(
        options.settings.bucket,
        options.file.path,
        options.file.expiresin,
        (err, result) => err ? reject(err) : resolve(result)
      );
    }
    else {
      minio.presignedGetObject(
        options.bucket,
        options.key,
        24*60*60,
        (err, result) => err ? reject(err) : resolve(result)
      );
    }
  });
};

module.exports = getUrl;
