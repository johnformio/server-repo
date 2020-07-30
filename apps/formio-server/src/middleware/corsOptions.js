'use strict';
const _ = require('lodash');

/**
 * Provides CORS capabilities.
 *
 * Middleware to determine CORS access.
 */
module.exports = function(router) {
  return function(req, callback) {
    let whitelist = [
      'https://form.io',
      'https://test-form.io',
      'https://develop-form.io',
      'https://portal.form.io',
      'https://portal.test-form.io',
      'https://portal.develop-form.io',
      'https://next.form.io',
      'https://alpha.form.io',
      'https://beta.form.io',
      'https://classic.form.io',
    ];
    const pass = {
      origin: true
    };
    const fail = {
      origin: 'https://form.io'
    };

    // Allow CORS if there is no project.
    if (
      !req.projectId ||
      (req.projectId === 'available') ||
      !router.formio.formio.mongoose.Types.ObjectId.isValid(req.projectId)
    ) {
      return callback(null, pass);
    }

    // Disallow cors if they are attempting to use a token as querystring.
    if (req.query.hasOwnProperty('token')) {
      return callback(null, fail);
    }

    // Support localhost for domain name.
    if (
      req.header('Origin') && (
        req.header('Origin').includes('http://localhost:') ||
        req.header('Origin').includes('http://portal.localhost:')
      )
    ) {
      return callback(null, pass);
    }

    // Disallow CORS for authoring stages.
    if (
      !_.get(req, 'projectLicense.live', true) &&
      req.url.includes('/submission')
    ) {
      if (
        whitelist.includes(req.header('Origin')) ||
        router.formio.formio.origin === req.header('Origin')
      ) {
        return callback(null, pass);
      }
      else {
        return callback(null, fail);
      }
    }

    // Load the project settings.
    router.formio.formio.hook.settings(req, function(err, settings) {
      if (err) {
        if (err === 'Project not found') {
          return callback(null, pass);
        }
        return callback(err);
      }

      // Build the list of supported domains.
      settings = settings || {};
      const cors = settings.cors || '*';
      whitelist = whitelist.concat(cors.split(/[\s,]+/));

      // Support * for domain name.
      if (whitelist.indexOf('*') !== -1) {
        return callback(null, pass);
      }

      if (whitelist.indexOf(req.header('Origin')) !== -1) {
        return callback(null, pass);
      }
      else {
        return callback(null, fail);
      }
    });
  };
};
