'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const keygenerator = require('keygenerator');
const debug = {
  decrypt: require('debug')('formio:util:decrypt')
};

const defaultSaltLength = 40;
const Utils = {
  /* eslint-disable no-useless-escape */
  tokenRegex: new RegExp(/\[\[\s*token\(\s*([^\)]+)\s*\)\s*,?\s*([0-9]*)\s*\]\]/gi),
  /* eslint-enable no-useless-escape */
  query: (query) => {
    return Object.keys(query).map((k) => {
      return `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`;
    }).join('&');
  },
  baseUrl(formio, req) {
    if (process.env.hasOwnProperty('BASE_URL')) {
      return formio.config.apiHost;
    }
    if (req.headers && req.headers.host) {
      return `${req.protocol}://${req.headers.host}`;
    }
    if (!req.protocol || !req.host) {
      return formio.config.apiHost;
    }
    return `${req.protocol}://${req.host}`;
  },
  toMongoId(id) {
    id = id || '';
    let str = '';
    for (let i = 0; i < id.length; i++) {
      str += id[i].charCodeAt(0).toString(16);
    }
    return _.padEnd(str.substr(0, 24), 24, '0');
  },
  ssoTokens(text) {
    const tokens = [];
    text.replace(Utils.tokenRegex, (match, $1, $2) => {
      const parts = $1.split('=');
      const field = _.trim(parts[0]);
      const resources = parts[1] ? _.map(parts[1].split(','), _.trim) : [];
      let expireTime = parseInt(_.trim($2), 10);
      if (!expireTime || isNaN(expireTime)) {
        expireTime = 120;
      }
      if (!field) {
        return match;
      }
      tokens.push({
        resources: resources,
        expireTime: expireTime,
        field: field
      });
      return match;
    });
    return tokens;
  },
  encrypt(secret, rawData, nosalt) {
    if (!secret || !rawData) {
      return null;
    }

    const salt = nosalt ? '' : keygenerator._({
      length: defaultSaltLength
    });
    const cipher = crypto.createCipher('aes-256-cbc', secret);
    const decryptedJSON = JSON.stringify(rawData) + salt;

    return Buffer.concat([
      cipher.update(decryptedJSON),
      cipher.final()
    ]);
  },
  decrypt(secret, cipherbuffer, nosalt) {
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
      data = JSON.parse(nosalt ? decryptedJSON : decryptedJSON.slice(0, -defaultSaltLength));
    }
    catch (e) {
      debug.decrypt(e);
      data = null;
    }

    return data;
  },
  decryptProperty: (obj, encryptedName, plainName, secret) => {
    if (!obj) {
      return obj;
    }
    if (!obj[encryptedName]) {
      if (!obj[plainName]) {
        obj[plainName] = {};
      }
      return obj;
    }
    obj[plainName] = Utils.decrypt(secret, obj[encryptedName], true);
    if (!obj[plainName]) {
      obj[plainName] = {};
    }
    delete obj[encryptedName];
    return obj;
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
  },
};

module.exports = Utils;
