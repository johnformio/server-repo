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
  const deleteProject = async function(req, res, next) {
    try {
      await prune.project(req.projectId);

      const settings = req.primaryProject.settings;
      if (settings && settings.defaultStage === req.projectId) {
        await formio.cache.updateProject(
          req.primaryProject._id,
          {settings: {defaultStage: ''}});
        res.sendStatus(200);
        return next();
      }
      else {
        res.sendStatus(200);
        return next();
      }
    }
    catch (err) {
      debug(err);
      return next(err);
    }
  };

  return async function(req, res, next) {
    if (req.method !== 'DELETE' || !req.projectId || !req.user._id) {
      return next();
    }

    try {
      const project = await formio.cache.loadPrimaryProject(req);

      if (!project) {
        return res.status(400).send('Environment project doesnt exist.');
      }

      req.primaryProject = project;

      if (
        (formio.util.idToString(req.user._id) === formio.util.idToString(project.owner)) ||
        (req.remotePermission === 'team_admin') || (req.remotePermission === 'owner')
      ) {
        return deleteProject(req, res, next);
      }
      else if (req.user) {
        const access = _.chain(project.access)
          .filter({type: 'team_admin'})
          .head()
          .get('roles', [])
          .map(formio.util.idToString)
          .value();
        const roles = _.map(req.user.teams, formio.util.idToString);
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
    }
    catch (err) {
      debug(err);
      return res.status(400).send(err);
    }
  };
};
