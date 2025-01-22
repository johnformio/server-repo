'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:restrictProjectAccess');

/**
 * Formio Middleware to access to only users with minimal level.
 */
module.exports = (formio) => {
  const getProjectAccess = (settings, permissions) => _.chain(settings)
    .find({type: permissions})
    .get('roles', [])
    .map(formio.util.idToString)
    .value();

  const getUserAccess = (user, project) => {
    if (project.owner.toString() === user._id.toString()) {
      return 'owner';
    }

    const userTeams = _.map(user.teams, formio.util.idToString);
    for (const accessLevel of ['admin', 'write', 'read']) {
      const projectTeams = getProjectAccess(project.access, `team_${accessLevel}`);
      if (_.intersection(projectTeams, userTeams).length !== 0) {
        return accessLevel;
      }
    }

    return 'none';
  };

  const accessLevels = ['none', 'read', 'write', 'admin', 'owner'];

  return (settings = {}) => async (req, res, next) => {
    try {
      const {
        level: accessLevel,
      } = settings;

      if (!accessLevel) {
        debug('No access level provided');
        throw new Error();
      }

      if (!req.projectId) {
        throw new Error('No project id found with the request.');
      }

      // Allow access if access key is set.
      if (req.isAdmin) {
        return next();
      }

      if (!req.user || !req.user._id) {
        throw new Error();
      }

      // Get the owner of the Project
      const project = await formio.cache.loadPrimaryProject(req);
      if (!project) {
        const error = new Error('Project not found');
        error.status = 400;
        throw error;
      }

      if (!project.owner && accessLevel === 'owner') {
        const error = new Error('No project owner found');
        error.status = 400;
        throw error;
      }

      const userAccess = getUserAccess(req.user, project);
      if (accessLevels.indexOf(userAccess) >= accessLevels.indexOf(accessLevel)) {
        return next();
      }

      throw new Error();
    }
    catch (err) {
      if (!err.status) {
        return res.sendStatus(401);
      }

      debug(err);
      return res.status(err.status || 400).send(err.message || err);
    }
  };
};
