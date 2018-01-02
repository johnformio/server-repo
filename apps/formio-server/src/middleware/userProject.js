'use strict';

var debug = require('debug')('formio:middleware:userProject');

/**
 * The userProject middleware.
 *
 * This middleware is used for adding the user project to the request object.
 *
 * @param cache
 * @returns {Function}
 */
module.exports = function(formio) {
  return function(req, res, next) {
    if (req.token && !req.userProject) {
      const projectId = req.token.project ? req.token.project._id : req.token.form.project;
      formio.cache.loadProject(req, projectId, function(err, project) {
        if (err) {
          return next(err);
        }
        debug(project);
        req.userProject = project;
        next();
      });
    }
    else {
      return next();
    }
  };
};
