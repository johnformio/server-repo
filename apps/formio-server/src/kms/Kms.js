'use strict';

module.exports = class Kms {
  constructor(config, alg) {
    this.config = config;
    this.alg = alg || this.defaultAlg;
  }

  get defaultAlg() {
    return  'PS256';
  }

  async init() {
  }

  async sign(data) {
    return Promise.resolve();
  }

  async verify(signature) {
    return Promise.resolve();
  }
};
