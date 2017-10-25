'use strict';

var _ = require('lodash');
var crypto = require('crypto');
var keygenerator = require('keygenerator');
var debug = {
  decrypt: require('debug')('formio:util:decrypt')
};

const defaultSaltLength = 40;

module.exports = {
  /* eslint-disable no-useless-escape */
  tokenRegex: new RegExp(/\[\[\s*token\(\s*([^\)]+\s*)\)\s*,?\s*([0-9]*)\s*\]\]/i),
  /* eslint-enable no-useless-escape */
  query: (query) => {
    return Object.keys(query).map((k) => {
      return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]);
    }).join('&');
  },
  ssoToken: function(text) {
    var matches = text.match(this.tokenRegex);
    if (matches && matches.length > 1) {
      var parts = matches[1].split('=');
      var field = _.trim(parts[0]);
      var resources = _.map(parts[1].split(','), _.trim);
      var expireTime = parseInt(_.trim(matches[2]), 10);
      if (!expireTime || isNaN(expireTime)) {
        expireTime = 120;
      }
      if (!resources || !resources.length) {
        return null;
      }
      if (!field) {
        return null;
      }

      // Return the sso token information.
      return {
        resources: resources,
        expireTime: expireTime,
        field: field
      };
    }
    return null;
  },
  encrypt: function(secret, rawData) {
    if (!secret || !rawData) {
      return null;
    }

    const salt = keygenerator._({
      length: defaultSaltLength
    });
    const cipher = crypto.createCipher('aes-256-cbc', secret);
    const decryptedJSON = JSON.stringify(rawData) + salt;

    return Buffer.concat([
      cipher.update(decryptedJSON),
      cipher.final()
    ]);
  },
  decrypt: function(secret, cipherbuffer) {
    if (!secret || !cipherbuffer) {
      return null;
    }
    let data = {};

    try {
      const buffer = Buffer.isBuffer(cipherbuffer) ? cipherbuffer : cipherbuffer.buffer;
      const decipher = crypto.createDecipher('aes-256-cbc', secret);
      const decryptedJSON = Buffer.concat([
        decipher.update(buffer), // Buffer contains encrypted utf8
        decipher.final()
      ]);
      data = JSON.parse(decryptedJSON.slice(0, -defaultSaltLength));
    }
    catch (e) {
      debug.decrypt(e);
    }

    return data;
  }
};
