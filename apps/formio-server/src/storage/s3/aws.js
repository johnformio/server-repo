'use strict';
const _ = require('lodash');
const {formatUrl} = require("@aws-sdk/util-format-url");
const {createRequest} = require("@aws-sdk/util-create-request");
const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} = require('@aws-sdk/client-s3');
const {getSignedUrl, S3RequestPresigner} = require("@aws-sdk/s3-request-presigner");
const debug = {
  s3: require('debug')('formio:s3')
};

const {MB_IN_BYTES, GB_IN_BYTES, TB_IN_BYTES} = require('./constants');

function getS3Client(settings = {}) {
  const config = {
    region: settings.region || 'us-east-1',
  };

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
}

function getAWSPresignedGetUrl(s3Settings, bucket, key) {
  const client = getS3Client(s3Settings);
  const getObjectCommand = new GetObjectCommand({Bucket: bucket, Key: key});
  return getSignedUrl(
    client,
    getObjectCommand,
    (s3Settings.expiration ? {expiresIn: +s3Settings.expiration} : {})
  );
}

function constructCommandParams(s3Settings, file) {
  const params = {
    Bucket: s3Settings.bucket,
    Key: file.path,
    ContentType: file.type,
  };

  if (s3Settings.acl) {
    params.ACL = s3Settings.acl;
  }
  if (s3Settings.encryption === 'aes') {
    params.ServerSideEncryption = 'AES256';
  }
  else if (s3Settings.encryption === 'kms' && s3Settings.kmsKey) {
    params.ServerSideEncryption = 'aws:kms';
    params.SSEKMSKeyId = s3Settings.kmsKey;
  }
  return params;
}

async function getAWSPresignedPutUrl(s3Settings, file) {
  try {
    const client = getS3Client(s3Settings);
    const commandParams = constructCommandParams(s3Settings, file);
    // https://github.com/aws/aws-sdk-js-v3/issues/1576
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/
    // Create an AWS SDK request object for uploading an object to S3
    const signer = new S3RequestPresigner({...client.config});
    const request = await createRequest(client, new PutObjectCommand(commandParams));
    const presigned = await signer.presign(request, {expiresIn: file.expiresin});
    const presignedUrl = formatUrl(presigned);
    return {url: presignedUrl, headers: presigned.headers};
  }
  catch (err) {
    // log the error, but try and fallback to legacy manually signed upload url
    debug(err);
    debug('Attempting to fall back to legacy manualy signed upload url');
    return {url: null, headers: {}};
  }
}

function bestGuessPartSize(fileSize) {
  if (fileSize > 10 * MB_IN_BYTES && fileSize <= 100 * MB_IN_BYTES)  {
    return 10 * MB_IN_BYTES;
  }
  if (fileSize > 100 * MB_IN_BYTES && fileSize <= GB_IN_BYTES) {
    return 50 * MB_IN_BYTES;
  }
  if (fileSize > GB_IN_BYTES && fileSize <= 25 * GB_IN_BYTES) {
    return 100 * MB_IN_BYTES;
  }
  if (fileSize > 25 * GB_IN_BYTES && fileSize <= 100 * GB_IN_BYTES) {
    return 250 * MB_IN_BYTES;
  }
  else if (fileSize > 100 * GB_IN_BYTES && fileSize <= 500 * GB_IN_BYTES) {
    return 500 * MB_IN_BYTES;
  }
  else if (fileSize > 500 * GB_IN_BYTES && fileSize <= TB_IN_BYTES) {
    return 750 * MB_IN_BYTES;
  }
}

async function getAWSPresignedMultipartUrls(s3Settings, file) {
  const client = getS3Client(s3Settings);
  const baseParams = constructCommandParams(s3Settings, file);

  const initiateCmd = new CreateMultipartUploadCommand(baseParams);
  const {UploadId: uploadId} = await client.send(initiateCmd);

  const partSizeActual = file.size > file.multipart.partSize * MB_IN_BYTES
    ? file.multipart.partSize * MB_IN_BYTES
    : bestGuessPartSize(file.size);
  const numChunks = Math.ceil(file.size / partSizeActual);

  const presignedPromises = [];
  for (let i = 0; i < numChunks; i++) {
    const uploadParams = {
      ...baseParams,
      UploadId: uploadId,
      PartNumber: i + 1,
    };
    const uploadCmd = new UploadPartCommand(uploadParams);
    // https://github.com/aws/aws-sdk-js-v3/issues/1576
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/
    // Create an AWS SDK request object for uploading an object to S3
    const signer = new S3RequestPresigner({...client.config});
    const request = await createRequest(client, uploadCmd);
    const promise = signer.presign(request, {expiresIn: file.expiresin});
    presignedPromises.push(promise);
  }
  const presignedArr = await Promise.all(presignedPromises);
  return {
    urls: presignedArr.map((presigned) => formatUrl(presigned)),
    headers: presignedArr[0]?.headers || {},
    uploadId,
    partSizeActual
  };
}

async function completeAWSMultipartUpload(s3Settings, payload) {
  const client = getS3Client(s3Settings);
  const params = {
    Bucket: s3Settings.bucket,
    Key: payload.key,
    MultipartUpload: {
      Parts: payload.parts,
    },
    UploadId: payload.uploadId
  };
  const command = new CompleteMultipartUploadCommand(params);
  return client.send(command);
}

function abortAWSMultipartUpload(s3Settings, payload) {
  const client = getS3Client(s3Settings);
  const {uploadId, key} = payload;
  const params = {
    Bucket: s3Settings.bucket,
    Key: key,
    UploadId: uploadId
  };
  const command = new AbortMultipartUploadCommand(params);
  return client.send(command);
}

async function removeAWSObject(s3Settings, bucket, key) {
  const client = getS3Client(s3Settings);
  const deleteConfig = {
    Bucket: bucket,
    Key: key,
  };

  return await client.send(new DeleteObjectCommand(deleteConfig));
}

module.exports = {
  getAWSPresignedPutUrl,
  getAWSPresignedGetUrl,
  getAWSPresignedMultipartUrls,
  completeAWSMultipartUpload,
  abortAWSMultipartUpload,
  removeAWSObject,
};
