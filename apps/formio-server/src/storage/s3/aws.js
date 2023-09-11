'use strict';
const _ = require('lodash');
const formatUrl = require("@aws-sdk/util-format-url").formatUrl;
const createRequest = require("@aws-sdk/util-create-request").createRequest;
const {S3Client, GetObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');
const {getSignedUrl, S3RequestPresigner} = require("@aws-sdk/s3-request-presigner");

const getAWS = function(settings = {}) {
  const config = {};
  config.region = settings.region || 'us-east-1';
  if (settings.AWSAccessKeyId) {
    _.set(config, 'credentials.accessKeyId', settings.AWSAccessKeyId);
  }
  if (settings.AWSSecretKey) {
    _.set(config, 'credentials.secretAccessKey', settings.AWSSecretKey);
  }

  if (settings.encryption) {
    config.signatureVersion = 'v4';
  }
  if (settings.endpoint) {
    config.endpoint = settings.endpoint;
  }

  // Return the AWS.S3 object.
  return new S3Client(config);
};

const getUrl = async function(options = {}) {
  const aws = getAWS(options.settings);

  if (options.method === 'PUT') {
    // If they have encryption or the region provided, then this will create a signed url.
    if ((options.settings.encryption || options.settings.region) && options.settings.bucket) {
      const putConfig = {
        Bucket: options.settings.bucket,
        Key: options.file.path,
        ContentType: options.file.type
      };
      if (options.settings && options.settings.acl) {
        putConfig.ACL = options.settings.acl;
      }

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

      // https://github.com/aws/aws-sdk-js-v3/issues/1576
      // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/
      // Create an AWS SDK request object for uploading an object to S3
      const request = await createRequest(aws, new PutObjectCommand(putConfig));
      
      // Instantiate an S3RequestPresigner object using AWS SDK configuration
      const signer = new S3RequestPresigner({...aws.config});
      
      // Generate a presigned request object with specified expiration time
      const presigned = await signer.presign(request, {expiresIn: options.file.expiresin});
      
      // Format into presigned URL
      const presignedUrl = formatUrl(presigned);
      
      // Return the presigned URL and headers object
      return {url: presignedUrl, headers: presigned.headers};
    }
    else {
      // Use the legacy manually signed upload url.
      return Promise.resolve();
    }
  }
  else {
    const getObjectCommand = new GetObjectCommand({Bucket: options.bucket, Key: options.key});
    return getSignedUrl(
      aws,
      getObjectCommand,
      (options.settings.expiration ? {expiresIn: +options.settings.expiration} : {})
    );
  }
};

module.exports = getUrl;
