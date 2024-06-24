'use strict';

/**
 * The userProject middleware.
 *
 * This middleware is used for adding the user project to the request object.
 *
 * @param cache
 * @returns {Function}
 */
module.exports = function(formio) {
  return async function(req, res, next) {
    if (req.token && !req.userProject) {
      const projectId = req.token.project ? req.token.project._id : req.token.form.project;
      try {
        const project = await formio.cache.loadProject(req, projectId);
        req.userProject = project;
        return next();
      }
      catch (err) {
        return next(err);
      }
    }
    else {
      return next();
    }
  };
};
