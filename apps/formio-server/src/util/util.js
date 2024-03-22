'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const config = require('../../config');
const keygenerator = require('keygenerator');
const debug = {
  decrypt: require('debug')('formio:util:decrypt'),
  db: require('debug')('formio:db'),
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
  toMongoId(id) {
    id = id || '';
    let str = '';
    for (let i = 0; i < id.length; i++) {
      str += id[i].charCodeAt(0).toString(16);
    }
    return _.padEnd(str.substr(0, 24), 24, '0');
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
      obj[plainName] = {cannotDecrypt: true};
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
    if (config.formio.hosted) {
      return next();
    }

    // Return if the submission model is already established.
    if (req.submissionModel) {
      return next(null, req.submissionModel);
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

      // Set the submission model. Mongoose does not automatically create a collection upon establishing a model, (see
      // https://mongoosejs.com/docs/api/model.html#model_Model-createCollection), so we'll call init() to create the model
      // if it has indexes or prepare it to be created upon an initial submission
      debug.db(`Setting submission model to ${collectionName} from submission schema and creating a collection`);
      req.submissionModel = formio.mongoose.model(collectionName, formio.schemas.submission, collectionName, init);
      req.submissionModel.init((err) => {
        if (err) {
          return next(err);
        }
        // Set custom submissions collection to be used by default if the request is related to submissions
        if (req.path.includes('/submission')) {
          req.model = req.submissionModel;
        }
        return next(null, req.submissionModel);
      });
    });
  },
  getSubmissionRevisionModel: (formio, req, form, init, next) => {
    if (!form) {
      return next('No form provided');
    }

    // No collection provided.
    if (!form.settings || !form.settings.collection) {
      return next();
    }

    // Disable for hosted projects
    if (config.formio.hosted) {
      return next();
    }

    // Return if the submission model is already established.
    if (req.submissionRevisionModel) {
      return next(null, req.submissionRevisionModel);
    }

    // Load the project in context.
    formio.cache.loadCache.load(req.projectId, (err, project) => {
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
      const collectionName = `${projectName}_${form.settings.collection.replace(/[^A-Za-z0-9]+/g, '')}_revisions`;

      // Set the submission revision model.
      req.submissionRevisionModel = formio.mongoose.model(collectionName, formio.schemas.submissionrevision, collectionName, init);

      // Establish a model using the schema.
      return next(null, req.submissionRevisionModel);
    });
  },
  getComponentDataByPath: (path, data) => {
    if (Array.isArray(path)) {
      return path.reduce((acc, key) => {
        return Utils.getComponentDataByPath(key, acc);
      }, data);
    }

    return Array.isArray(data) ? data.map(item => _.get(item, path)) : _.get(data, path);
  },
  transform: (obj, predicate) => {
    return Object.keys(obj).reduce((acc, key) => {
      if (predicate(key, obj[key])) {
          acc[key] = obj[key];
      }
      return acc;
    }, {});
  },
  parseUnknownContentResponse: (response) => {
    const contentType = response.headers.get("content-type");
    const contentLength = Number(response.headers.get("content-length"));

    if (contentLength > 0) {
      if (contentType.includes('application/json')) {
        return response.json();
      }
      else {
        return response.text();
      }
    }
    return {};
  },
  isEmptyObject(object) {
    return !!object && _.isEmpty(object) && object.constructor === Object;
  },
  isSuperAdmin(req) {
    // Allow admin key to act as admin.
    if (process.env.ADMIN_KEY && process.env.ADMIN_KEY === req.headers['x-admin-key']) {
      return true;
    }
  },
  escapeHtml(unsafeText) {
    return unsafeText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  },
  getAllObjectPaths(data, leavesOnly = false) {
    const paths = [];

    const iterate = (obj, path) => {
      path = path || '';
      for (const prop in obj) {
        if (prop && obj.hasOwnProperty(prop)) {
          if (typeof obj[prop] === 'object') {
            if (!leavesOnly && (path || prop)) {
              paths.push(path || prop);
            }
            iterate(obj[prop], `${path}${path ? '.' : ''}${prop}`);
          }
          else {
            paths.push(`${path}${path ? '.' : ''}${prop}`);
          }
        }
      }
    };

    iterate(data, '');

    return paths;
  },
};

module.exports = Utils;
