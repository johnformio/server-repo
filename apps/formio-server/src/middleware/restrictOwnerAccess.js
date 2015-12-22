'use strict';

var _ = require('lodash');
var debug = require('debug')('formio:middleware:restrictOwnerAccess');

module.exports = function(formio) {
  var cache = require('../cache/cache')(formio);

  /**
   * Formio Middleware to access to only project owners.
   */
  return function(req, res, next) {
    if (!req.projectId) {
      debug('No project id found with the request.');
      return res.sendStatus(400);
    }

    if (!req.user || !req.user._id) {
      return res.sendStatus(401);
    }

    // Get the owner of the Project
    cache.loadProject(req, req.projectId, function(err, project) {
      if (err) {
        debug(err);
        return res.sendStatus(400);
      }
      if (!project.owner) {
        debug('No project owner found... ' + JSON.stringify(project));
        return res.sendStatus(500);
      }



      if (project.owner.toString() !== req.user._id.toString()) {
        debug('User is not project owner. Access restricted.');
        return res.sendStatus(401);
      }


      debug('User is project owner.');
      next();
    });
  };
};
