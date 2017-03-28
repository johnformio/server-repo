'use strict';

var debug = require('debug')('formio:middleware:restrictOwnerAccess');

module.exports = function(formio) {
  var cache = require('../cache/cache')(formio);

  /**
   * Formio Middleware to access to only project owners.
   */
  return function(req, res, next) {
    new Promise((resolve, reject) => {
      if (!req.projectId) {
        debug('No project id found with the request.');
        return reject('No project id found with the request.');
      }

      if (!req.user || !req.user._id) {
        debug('No user id found with the request.');
        return reject();
      }

      // Get the owner of the Project
      cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return reject(err);
        }
        if (!project.owner) {
          let error = new Error('No project owner found');
          error.status = 500;

          debug('No project owner found... ' + JSON.stringify(project));
          return reject(error);
        }

        if (project.owner.toString() !== req.user._id.toString()) {
          debug('User is not project owner. Access restricted.');
          return reject();
        }

        debug('User is project owner.');
        return resolve();
      });
    })
    .then(() => {
      return next();
    })
    .catch(err => {
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
