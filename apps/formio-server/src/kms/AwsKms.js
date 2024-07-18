'use strict';
const _ = require('lodash');
const Kms = require('./Kms');
const {KMSClient, SignCommand, VerifyCommand} = require('@aws-sdk/client-kms');
const crypto = require('crypto');
const base64url = require('base64url');
const debug = require('debug')('formio:kms:awskms');

module.exports = class AwsKms extends Kms {
  constructor(config, alg) {
    super(config, alg);
    this.init();
  }

  get defaultAlg() {
    return 'RSASSA_PSS_SHA_256';
  }

  init() {
    const {region = 'us-east-1', AWSAccessKeyId, AWSSecretKey} =  this.config;
    const kmsClientConfig = {
      region,
    };

    if (AWSAccessKeyId) {
      _.set(kmsClientConfig, 'credentials.accessKeyId', AWSAccessKeyId);
    }

    if (AWSSecretKey) {
      _.set(kmsClientConfig, 'credentials.secretAccessKey', AWSSecretKey);
    }

    this.client = new KMSClient(kmsClientConfig);
  }

  createDigestFromString(stringValue) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(stringValue));
    return hash.digest();
  }

  getSignatureHeaders() {
    return {
      alg:  'PS256',
      typ: 'JWT',
      kid: this.config.keyId,
    };
  }

  async sign(data) {
    const tokenComponents = {
      header: base64url(JSON.stringify(this.getSignatureHeaders())),
      payload: base64url(JSON.stringify(data)),
    };

    const input = {
      KeyId: this.config.keyId,
      Message: this.createDigestFromString(`${tokenComponents.header}.${tokenComponents.payload}`),
      MessageType: 'DIGEST',
      SigningAlgorithm: this.alg,
    };

    const command = new SignCommand(input);
    const response = await this.client.send(command);
    const signature = Buffer.from(response.Signature).toString('base64');

    return `${tokenComponents.header}.${tokenComponents.payload}.${signature}`;
  }

  async verify(signature) {
    if (!signature || !_.isString(signature)) {
      return;
    }
    const [headerBase64, payloadBase64, signatureBase64] = _.split(signature, '.');
    const verificationInput = {
      KeyId: this.config.keyId,
      Message:  this.createDigestFromString(`${headerBase64}.${payloadBase64}`),
      MessageType: 'DIGEST',
      Signature: Buffer.from(signatureBase64, 'base64'),
      SigningAlgorithm: this.alg
    };

    try {
      const verificationCommand = new VerifyCommand(verificationInput);
      const verificationResponse = await this.client.send(verificationCommand);

      if (verificationResponse.SignatureValid) {
        return JSON.parse(base64url.decode(payloadBase64));
      }

      return null;
    }
    catch (error) {
      debug(error);
      return error;
    }
    // OPTIMIZATION WAY - another option to verify signature: get Public Key on the kms init and use it to verify signature with JOSE library.
    // const input = {
    //   KeyId: this.config.keyId,
    // };
    // const command = new GetPublicKeyCommand(input);
    // const response = await this.client.send(command);
    // const publicKey = Buffer.from(response.PublicKey).toString('base64');
    // const keye= `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    // const {payload} = await compactVerify(
    //   signature,
    //   crypto.createPublicKey(keye),
    // );
    // return JSON.parse(new TextDecoder('utf-8').decode(payload))
  }
};
