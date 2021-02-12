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
    const config = _.get(router, 'formio.config', {});
    const domain = config.domain ? `*.${config.domain}` : '';

    const directives = {
      'default-src': [
        '\'self\'',
        '\'unsafe-inline\'',
        '\'unsafe-eval\'',
        'fonts.googleapis.com',
        'fonts.gstatic.com',
        'blob:',
        'data:',
        'cdn.form.io',
        domain
      ]
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

      if (domain && cspSettings['default-src'].indexOf(domain) === -1) {
        cspSettings['default-src'].push(domain);
      }

      const portalDomain = settings.portalDomain || '';

      if (portalDomain && cspSettings['default-src'].indexOf(portalDomain) === -1) {
        cspSettings['default-src'].push(portalDomain);
      }

      return createCSPMiddleware(cspSettings)(req, res, next);
    });
  };
};
