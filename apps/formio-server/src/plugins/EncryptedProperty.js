'use strict';

/**
 * Inspired by:
 *  https://github.com/digitaledgeit/js-mongoose-encrypted-property/issues/1
 *  https://github.com/joegoldbeck/mongoose-encryption/issues/12
 */
const crypto = require('crypto');
const debug = {
  plugin: require('debug')('formio:plugins:EncryptedProperty'),
  error: require('debug')('formio:error')
};

/**
 * Mongoose encrypted property plugin. Encrypt a single field on the given schema.
 *
 * @param {Schema} schema
 *   The mongoose schema to use.
 * @param {Object} options
 *   options.secret - The key used for crypto.
 *   options.plainName - The plainName used for the encrypted field.
 */
module.exports = function(schema, options) {
  // Validate options
  options = options || {};
  if (!options.secret) {
    throw new Error('Please specify option.secret');
  }
  if (!options.plainName) {
    throw new Error('Please specify option.plainName');
  }

  /**
   * Encrypt the given data with the given secret.
   *
   * @param {String} secret
   *   The key used for crypto.
   * @param {Object}
   *   The content to encrypt.
   *
   * @returns {Buffer}
   */
  function encrypt(secret, mixed) {
    if (!secret || !mixed) {
      return null;
    }

    const cipher = crypto.createCipher('aes-256-cbc', secret);
    const decryptedJSON = JSON.stringify(mixed);

    return Buffer.concat([
      cipher.update(decryptedJSON),
      cipher.final()
    ]);
  }

  /**
   * Decrypt some text
   *
   * @param {String} secret
   *   The key used for crypto.
   * @param {Buffer} cipherbuffer
   *   The content to decrypt.
   *
   * @returns {Object}
   *   Decrypted content.
   */
  function decrypt(secret, cipherbuffer) {
    if (!secret || !cipherbuffer) {
      return null;
    }
    let data = {};

    try {
      const decipher = crypto.createDecipher('aes-256-cbc', secret);
      const decryptedJSON = Buffer.concat([
        decipher.update(cipherbuffer), // Buffer contains encrypted utf8
        decipher.final()
      ]);
      data = JSON.parse(decryptedJSON);
    }
    catch (e) {
      debug.error(e);
    }

    return data;
  }

  // Add a Buffer property to store the encrypted data
  const encryptedName = `${options.plainName}_encrypted`;
  const bufferProperty = {};
  bufferProperty[encryptedName] = 'Buffer';
  schema.add(bufferProperty);

  // Add a Virtual property to access with decrypted data
  schema.virtual(options.plainName)
    .get(function() {
      // Decrypt the value
      if (this[encryptedName]) {
        const plaintext = decrypt(options.secret, this[encryptedName]);
        return plaintext;
      }

      return null;
    })
    .set(function(value) {
      // Encrypt and set the value
      const ciphertext = encrypt(options.secret, value);
      this[encryptedName] = ciphertext;
    });

  // Decrypt data when converted using toJSON.
  schema.set('toJSON', {
    transform(doc, ret, opts) {
      delete ret[encryptedName];
      const temp = decrypt(options.secret, doc[encryptedName]);

      if (temp) {
        ret[options.plainName] = temp;
      }

      debug.plugin(ret);
      return ret;
    }
  });

  // Decrypt data when converted using toObject.
  schema.set('toObject', {
    transform(doc, ret, opts) {
      delete ret[encryptedName];
      const temp = decrypt(options.secret, doc[encryptedName]);

      if (temp) {
        ret[options.plainName] = temp;
      }

      debug.plugin(ret);
      return ret;
    }
  });
};
