'use strict';

module.exports = function(formio) {
  /**
   * Formio Middleware to change the modified date of a project if the project definition has changed..
   */
  return function(req, res, next) {
    // Only modify for put and post requests.
    if (req.method !== 'PUT' || req.method !== 'POST' || req.method !== 'PATCH') {
      return next();
    }

    // Update the current project.
    // eslint-disable-next-line callback-return
    next();
    formio.cache.updateCurrentProject(req, {
      modified: true
    });
  };
};
