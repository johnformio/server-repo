'use strict';

const _ = require('lodash');
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
  const prune = require('../util/delete')(formio);
  const deleteProject = function(req, res, next) {
    prune.project(req.projectId, function(err) {
      if (err) {
        debug(err);
        return next(err);
      }

      return res.sendStatus(200);
    });
  };

  return function(req, res, next) {
    if (req.method !== 'DELETE' || !req.projectId || !req.user._id) {
      return next();
    }

    formio.cache.loadPrimaryProject(req, function(err, project) {
      if (err) {
        debug(err);
        return res.status(400).send(err);
      }

      if (!project) {
        return res.status(400).send('Environment project doesnt exist.');
      }

      if (formio.util.idToString(req.user._id) === formio.util.idToString(project.owner)) {
        return deleteProject(req, res, next);
      }
      else if (req.user) {
        const access = _.chain(project.access)
          .filter({type: 'team_admin'})
          .head()
          .get('roles', [])
          .map(formio.util.idToString)
          .value();
        const roles = _.map(req.user.roles, formio.util.idToString);
        if (_.intersection(access, roles).length !== 0) {
          return deleteProject(req, res, next);
        }
        else {
          return res.sendStatus(401);
        }
      }
      else {
        return res.sendStatus(401);
      }
    });
  };
};
