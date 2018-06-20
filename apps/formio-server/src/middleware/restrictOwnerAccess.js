'use strict';

const debug = require('debug')('formio:middleware:restrictOwnerAccess');

module.exports = function(formio) {
  /**
   * Formio Middleware to access to only project owners.
   */
  return function(req, res, next) {
    new Promise((resolve, reject) => {
      if (!req.projectId) {
        return reject('No project id found with the request.');
      }

      // Allow access if access key is set.
      if (req.isAdmin) {
        return resolve();
      }

      if (!req.user || !req.user._id) {
        return reject();
      }

      // Get the owner of the Project
      formio.cache.loadPrimaryProject(req, function(err, project) {
        if (err) {
          return reject(err);
        }
        if (!project.owner) {
          const error = new Error('No project owner found');
          error.status = 500;
          return reject(error);
        }

        if (project.owner.toString() !== req.user._id.toString()) {
          return reject();
        }

        return resolve();
      });
    })
    .then(next)
    .catch((err) => {
      try {
        if (!err) {
          return res.sendStatus(401);
        }

        debug(err);
        return res.status(err.status || 400).send(err.message || err);
      }
      catch (e) {
        debug(e);
      }
    });
  };
};
