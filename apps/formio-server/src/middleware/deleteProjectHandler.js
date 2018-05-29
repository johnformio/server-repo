'use strict';

const debug = require('debug')('formio:middleware:deleteProjectHandler');

/**
 * The deleteProjectHandler middleware.
 *
 * This middleware is used for flagging Projects as deleted rather than actually deleting them.
 *
 * @param router
 * @returns {Function}
 */
module.exports = function(formio) {
  return function(req, res, next) {
    if (req.method !== 'DELETE' || !req.projectId || !req.user._id) {
      return next();
    }

    formio.cache.loadPrimaryProject(req, function(err, project) {
      if (err) {
        debug(err);
        return next();
      }

      const owner = (formio.util.idToString(req.user._id) === formio.util.idToString(project.owner));
      if (owner) {
        const prune = require('../util/delete')(formio);
        prune.project(req.projectId, function(err) {
          if (err) {
            debug(err);
            return next(err);
          }

          return res.sendStatus(200);
        });
      }
      else {
        return res.sendStatus(401);
      }
    });
  };
};
