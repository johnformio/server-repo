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

  return (settings = {}) => (req, res, next) => new Promise((resolve, reject) => {
    const {
      level: accessLevel,
    } = settings;

    if (!accessLevel) {
      debug('No access level provided');
      return reject();
    }

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
    formio.cache.loadPrimaryProject(req, (err, project) => {
      if (err) {
        return reject(err);
      }

      if (!project.owner && accessLevel === 'owner') {
        const error = new Error('No project owner found');
        error.status = 400;
        return reject(error);
      }

      const userAccess = getUserAccess(req.user, project);
      if (accessLevels.indexOf(userAccess) >= accessLevels.indexOf(accessLevel)) {
        return resolve();
      }

      return reject();
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
