'use strict';
const _ = require('lodash');
const config = require('../../config');

/**
 * Provides CORS capabilities.
 *
 * Middleware to determine CORS access.
 */
module.exports = function(router) {
  return function(req, callback) {
    let whitelist = [];
    if (config.formio.hosted) {
      whitelist = [
        'https://form.io',
        'https://api.form.io',
        'https://cdn.form.io',
        'https://test-form.io',
        'https://develop-form.io',
        'https://portal.form.io',
        'https://portal.test-form.io',
        'https://portal.develop-form.io',
        'https://next.form.io',
        'https://alpha.form.io',
        'https://beta.form.io',
        'https://classic.form.io',
        'https://edge.form.io',
      ];
    }

    const pass = {
      maxAge: 600,
      origin: true
    };
    const fail = {
      origin: 'https://form.io'
    };

    // When using a development license, restrict CORS to only allow "localhost".
    if (_.get(router, 'license.devLicense', false)) {
      return callback(null, {
        origin: [/http:\/\/localhost:/, /http:\/\/\w+.localhost:/]
      });
    }

    // Disallow cors if they are attempting to use a token as querystring.
    if (!req.header('Origin') || req.header('Origin') === 'null') {
      return callback(null, pass);
    }

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

    // Load the project settings.
    router.formio.formio.hook.alter('parentProjectSettings', req, function(err, settings) {
      if (err) {
        if (err === 'Project not found') {
          return callback(null, pass);
        }
        return callback(err);
      }

      settings = settings || {};
      if (settings.portalDomain) {
        whitelist.push(settings.portalDomain);
      }

      // Build the list of supported domains.
      const cors = settings.cors || '*';
      whitelist = whitelist.concat(cors.split(/[\s,]+/));

      if (settings.appOrigin) {
        whitelist.push(settings.appOrigin);
      }

      if (whitelist.indexOf(req.header('Origin')) !== -1) {
        return callback(null, pass);
      }
      else {
        // Support * for domain name.
        if (whitelist.indexOf('*') !== -1) {
          return callback(null, {
            origin: '*'
          });
        }
        return callback(null, fail);
      }
    });
  };
};
