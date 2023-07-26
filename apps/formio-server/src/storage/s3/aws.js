'use strict';
const AWS = require('@aws-sdk/client-s3');
const {getSignedUrl} = require("@aws-sdk/s3-request-presigner");

const getAWS = function(settings = {}) {
  const config = {};
  if (settings.AWSAccessKeyId) {
    config.accessKeyId = settings.AWSAccessKeyId;
  }
  if (settings.AWSSecretKey) {
    config.secretAccessKey = settings.AWSSecretKey;
  }
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
        getSignedUrl(aws, new AWS.PutObjectCommand(putConfig), {expiresIn: options.file.expiresIn})
        .then((result) => resolve(result))
        .catch((err) => reject(err));
      }
      else {
        // Use the legacy manually signed upload url.
        return resolve();
      }
    }
    else {
      const getObjectCommand = new AWS.GetObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
      });
      getSignedUrl(aws, getObjectCommand, {expiresIn: +options.settings.expiration})
      .then((result) => resolve(result))
      .catch((err) => reject(err));
    }
  });
};

module.exports = getUrl;
