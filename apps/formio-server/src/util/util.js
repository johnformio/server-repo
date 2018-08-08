'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const keygenerator = require('keygenerator');
const debug = {
  decrypt: require('debug')('formio:util:decrypt')
};

const defaultSaltLength = 40;

module.exports = {
  /* eslint-disable no-useless-escape */
  tokenRegex: new RegExp(/\[\[\s*token\(\s*([^\)]+\s*)\)\s*,?\s*([0-9]*)\s*\]\]/gi),
  /* eslint-enable no-useless-escape */
  query: (query) => {
    return Object.keys(query).map((k) => {
      return `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`;
    }).join('&');
  },
  ssoToken(text) {
    const matches = text.match(this.tokenRegex);
    if (matches && matches.length > 1) {
      const parts = matches[1].split('=');
      const field = _.trim(parts[0]);
      const resources = parts[1] ? _.map(parts[1].split(','), _.trim) : [];
      let expireTime = parseInt(_.trim(matches[2]), 10);

      if (!expireTime || isNaN(expireTime)) {
        expireTime = 120;
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
  encrypt(secret, rawData) {
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
  decrypt(secret, cipherbuffer) {
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
      data = null;
    }

    return data;
  },
  getSubmissionModel: (formio, req, form, init, next) => {
    if (!form) {
      return next('No form provided');
    }

    // No collection provided.
    if (!form.settings || !form.settings.collection) {
      return next();
    }

    // Disable for hosted projects
    if (process.env.FORMIO_HOSTED) {
      return next();
    }

    // Load the project in context.
    formio.cache.loadCurrentProject(req, (err, project) => {
      if (err) {
        delete form.settings.collection;
        return next(err);
      }

      if (!project) {
        delete form.settings.collection;
        return next('No project found');
      }

      if (project.plan !== 'commercial') {
        delete form.settings.collection;
        return next('Only Enterprise projects can set different form collections.');
      }

      // Get the project name.
      const projectName = project.name.replace(/[^A-Za-z0-9]+/g, '');
      if (!projectName) {
        return next('Invalid project name');
      }

      // Set the collection name.
      const collectionName = `${projectName}_${form.settings.collection.replace(/[^A-Za-z0-9]+/g, '')}`;

      // Make sure they don't clobber reserved collections.
      const reservedCollections = [
        'projects',
        'forms',
        'submissions',
        'actions',
        'roles',
        'formrevisions',
        'schema',
        'tags'
      ];
      if (reservedCollections.includes(collectionName)) {
        delete form.settings.collection;
        return next(`${collectionName} is a reserved collection name.`);
      }

      // Establish a model using the schema.
      return next(null, formio.mongoose.model(collectionName, formio.schemas.submission, collectionName, init));
    });
  }
};
