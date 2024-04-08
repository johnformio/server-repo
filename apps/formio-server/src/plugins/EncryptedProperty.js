'use strict';

const util = require('../util/util');

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
        const plaintext = util.decrypt(options.secret, this[encryptedName], true);
        return plaintext;
      }

      return null;
    })
    .set(function(value) {
      // Encrypt and set the value
      try {
        if (value.cannotDecrypt) {
          // Do not encrypt bad decrypted values!
          return;
        }
        const ciphertext = util.encrypt(options.secret, value, true);
        if (ciphertext) {
          this[encryptedName] = ciphertext;
        }
      }
      catch (err) {
        // do nothing...
      }
    });

  // Decrypt data when converted using toJSON.
  schema.set('toJSON', {
    transform(doc, ret, opts) {
      return util.decryptProperty(ret, encryptedName, options.plainName, options.secret);
    }
  });

  // Decrypt data when converted using toObject.
  schema.set('toObject', {
    transform(doc, ret, opts) {
      return util.decryptProperty(ret, encryptedName, options.plainName, options.secret);
    }
  });
};
