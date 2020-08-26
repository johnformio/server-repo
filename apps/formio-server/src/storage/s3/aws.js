'use strict';
const AWS = require('aws-sdk');

const getAWS = function(settings = {}) {
  const config = {
    accessKeyId: settings.AWSAccessKeyId,
    secretAccessKey: settings.AWSSecretKey
  };
  if (settings.region) {
    config.region = settings.region;
  }
  if (settings.encryption) {
    config.signatureVersion = 'v4';
  }
  if (settings.endpoint) {
    config.endpoint = settings.endpoint;
  }

  // Return the AWS.S3 object.
  return new AWS.S3(config);
};

const getUrl = function(options = {}) {
  return new Promise((resolve, reject) => {
    const aws = getAWS(options.settings);

    if (options.method === 'PUT') {
      // If they have encryption or the region provided, then this will create a signed url.
      if ((options.settings.encryption || options.settings.region) && options.settings.bucket) {
        const putConfig = {
          Bucket: options.settings.bucket,
          Key: options.file.path,
          ContentType: options.file.type,
          Expires: options.file.expiresin,
          ACL: options.settings.acl || 'private'
        };

        switch (options.settings.encryption) {
          case 'aes':
            putConfig.ServerSideEncryption = 'AES256';
            break;
          case 'kms':
            putConfig.ServerSideEncryption = 'aws:kms';
            break;
        }

        if ((options.settings.encryption === 'kms') && options.settings.kmsKey) {
          putConfig.SSEKMSKeyId = options.settings.kmsKey;
        }

        aws.getSignedUrl('putObject', putConfig, (err, result) => err ? reject(err) : resolve(result));
      }
      else {
        // Use the legacy manually signed upload url.
        return resolve();
      }
    }
    else {
      aws.getSignedUrl('getObject', {
        Bucket: options.bucket,
        Key: options.key
      }, (err, result) => err ? reject(err) : resolve(result));
    }
  });
};

module.exports = getUrl;
