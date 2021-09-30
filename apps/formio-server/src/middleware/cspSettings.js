'use strict';
const _ = require('lodash');
const helmet = require('helmet');

/**
 * Provides CSP settings.
 *
 * Middleware to set CSP.
 */
module.exports = function(router) {
  return function(req, res, next) {
    const hostParts = req.host.split('.');
    let host = '';
    if (hostParts[hostParts.length - 1].match(/^localhost(:[0-9]+)?$/)) {
      host = '*';
    }
    else {
      host = (hostParts.length > 1) ? hostParts.slice(-2).join('.') : req.host;
    }
    const sources = [
      '\'self\'',
      '\'unsafe-inline\'',
      '\'unsafe-eval\'',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'blob:',
      'data:',
      '*.form.io',
      'pro.formview.io',
      host,
      `*.${host}`
    ];
    const directives = {
      'default-src': sources
    };

    const createCSPMiddleware = (settings) => {
      return  helmet.contentSecurityPolicy({
        directives: settings,
      });
    };

    if (!req.projectId ||
      (req.projectId === 'available') ||
      !router.formio.formio.mongoose.Types.ObjectId.isValid(req.projectId)
    ) {
      return createCSPMiddleware(directives)(req, res, next);
    }

      // Load the project settings.
    router.formio.formio.hook.settings(req, function(err, settings) {
      if (err) {
        if (err === 'Project not found') {
          return createCSPMiddleware(directives)(req, res, next);
        }
        return next(err);
      }

      // Build the CSP settings string.
      settings = settings || {};
      let cspSettings = settings.csp || '';
      cspSettings = cspSettings.split(';');
      cspSettings = cspSettings.reduce((acc, item) => {
        const data = item.trim().split(/\s+/);
        const [key] = data.splice(0, 1);
        if (key) {
          acc[key] = data;
        }
        return acc;
      }, {...directives});

      if (host && cspSettings['default-src'].indexOf(host) === -1) {
        cspSettings['default-src'].push(host);
        cspSettings['default-src'].push(`*.${host}`);
      }

      const portalDomain = settings.portalDomain || '';

      if (portalDomain && cspSettings['default-src'].indexOf(portalDomain) === -1) {
        cspSettings['default-src'].push(portalDomain);
      }

      return createCSPMiddleware(cspSettings)(req, res, next);
    });
  };
};
