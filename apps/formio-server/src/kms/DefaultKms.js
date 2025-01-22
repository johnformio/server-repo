'use strict';
const crypto = require('crypto');
const Kms = require('./Kms');
const {CompactSign, importPKCS8, compactVerify, importSPKI} = require('jose');
const debug = require('debug')('formio:kms:default');

module.exports = class DefaultKms extends Kms {
  constructor(config = {}, alg) {
    super(config, alg);
    // expected private key: format - 'pem', type - 'pkcs8'; public key: format - 'pem', type - 'spki'
    // crypto.generateKeyPair(
    //   "rsa",
    //   {
    //     modulusLength: 2048,
    //     publicKeyEncoding: {
    //       type: 'spki',
    //       format: "pem",
    //     },
    //     privateKeyEncoding: {
    //       type: 'pkcs8',
    //       format: "pem",
    //     },
    //   },
    //   (err, publicKey, privateKey) => {});
    this.privateKey = config.privateKey;
    this.init();
  }

  get defaultAlg() {
    return  'PS256';
  }

  async init() {
    this.publicKey = this.getPublicKey();
  }

  async sign(data) {
    const formattedPrivateKey = await importPKCS8(this.privateKey, this.alg);

    return await new CompactSign(new TextEncoder().encode(JSON.stringify(data)))
      .setProtectedHeader({alg: this.alg})
      .sign(formattedPrivateKey);
  }

  async verify(signature) {
    try {
      const {payload} = await compactVerify(
        signature,
        await importSPKI(this.publicKey, this.alg)
      );

      return JSON.parse(new TextDecoder('utf-8').decode(payload));
    }
    catch (error) {
      debug(error);
      return error;
    }
  }

  getPublicKey() {
    try {
      const pubKeyObject = crypto.createPublicKey({
        key: this.privateKey,
        format: 'pem'
      });

      return pubKeyObject.export({
          format: 'pem',
          type: 'spki',
      });
    }
    catch (error) {
      debug(error);
      return error;
    }
  }
};

