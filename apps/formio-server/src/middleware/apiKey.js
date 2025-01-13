'use strict';

const _ = require('lodash');

/**
 * Provides URL alias capabilities.
 *
 * Middleware to resolve a form alias into its components.
 */
module.exports = function(formio) {
  // Handle the request.
  return async function(req, res, next) {
    // Get the API Token
    const token = req.headers.hasOwnProperty('x-token') ? req.headers['x-token'] : req.query['token'];

    // Load the current project.
    try {
      const currentProject = await formio.cache.loadCurrentProject(req);
      if (!currentProject) {
        return next();
      }

      // Skip the middleware if there are no apiKeys within the project.
      if (
        !currentProject.settings ||
        !currentProject.settings.keys ||
        (currentProject.settings.keys.length === 0) ||
        !token ||
        (token.length < 20) ||
        !_.find(currentProject.settings.keys, {key: token})
      ) {
        return next();
      }

      req.permissionsChecked = true;
      req.isAdmin = true;
      req.apiKey = true;
      req.user = null;
      req.token = null;
      return next();
    }
    catch (err) {
      return next();
    }
  };
};
