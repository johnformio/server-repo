'use strict';

var _ = require('lodash');
var crypto = require('crypto');
var debug = {
  decrypt: require('debug')('formio:util:decrypt')
};

module.exports = {
  tokenRegex: new RegExp(/\[\[\s*token\(\s*([^\)]+\s*)\)\s*,?\s*([0-9]*)\s*\]\]/i),
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

    var cipher = crypto.createCipher('aes-256-cbc', secret);
    var decryptedJSON = JSON.stringify(rawData);

    return Buffer.concat([
      cipher.update(decryptedJSON),
      cipher.final()
    ]);
  },
  decrypt: function(secret, cipherbuffer) {
    if (!secret || !cipherbuffer) {
      return null;
    }
    var data = {};

    try {
      var decipher = crypto.createDecipher('aes-256-cbc', secret);
      var decryptedJSON = Buffer.concat([
        decipher.update(cipherbuffer), // Buffer contains encrypted utf8
        decipher.final()
      ]);
      data = JSON.parse(decryptedJSON);
    }
    catch (e) {
      debug.decrypt(e);
    }

    return data;
  }
};
