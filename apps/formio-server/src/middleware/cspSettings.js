'use strict';
const helmet = require('helmet');

/**
 * Provides CSP settings.
 *
 * Middleware to set CSP.
 */
module.exports = function(router) {
  return async function(req, res, next) {
    const helmetOverrides = {};
    // Do not add opener, embedder, or resource policies.
    helmetOverrides.crossOriginOpenerPolicy = false;
    helmetOverrides.crossOriginEmbedderPolicy = false;
    helmetOverrides.crossOriginResourcePolicy = false;

    // Strict-Transport-Security middleware
    helmetOverrides.hsts = {
        includeSubDomains: true,
        preload: true,
        maxAge: 15552000
    };

    // Referer-Policy middleware
    helmetOverrides.referrerPolicy = {
        policy: ['origin', 'same-origin'],
    };

    const hostParts = req.hostname.split('.');
    let host = '';
    if (hostParts[hostParts.length - 1].match(/^localhost(:[0-9]+)?$/)) {
      host = '*';
    }
    else {
      host = (hostParts.length > 1) ? hostParts.slice(-2).join('.') : req.hostname;
    }

    const directives = {
      'upgrade-insecure-requests': null,
      'default-src': ['*'],
      'frame-src': ['*'],
      'child-src': ['*', 'blob:', 'data:'],
      'worker-src': ['*', 'blob:', 'data:'],
      'img-src': ['*', 'blob:', 'data:'],
      'media-src': ['*'],
      'script-src': ['*', "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ['*', "'unsafe-inline'"],
      'font-src': ['*', 'blob:', 'data:'],
      'connect-src': ['*']
    };

    if (/manage($|\/$)/.test(req.url) || req.url.endsWith('/manage/view/')) {
      directives['script-src-attr'] = ["'unsafe-inline'"];
    }

    const createCSPMiddleware = (settings) => {
      helmetOverrides.contentSecurityPolicy = {
        directives: settings,
      };
      return helmet(helmetOverrides);
    };

    if (!req.projectId ||
      (req.projectId === 'available') ||
      !router.formio.formio.mongoose.Types.ObjectId.isValid(req.projectId)
    ) {
      return createCSPMiddleware(directives)(req, res, next);
    }

      // Load the project settings.
    try {
      let settings = await router.formio.formio.hook.settings(req);
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

      if (!cspSettings['default-src'].includes(host)) {
        cspSettings['default-src'].push(host);
      }

      const portalDomain = settings.portalDomain || '';

      if (portalDomain && cspSettings['default-src'].indexOf(portalDomain) === -1) {
        cspSettings['default-src'].push(portalDomain);
      }

      return createCSPMiddleware(cspSettings)(req, res, next);
    }
    catch (err) {
      if (err.message === 'Project not found') {
        return createCSPMiddleware(directives)(req, res, next);
      }
      return next(err);
    }
  };
};
