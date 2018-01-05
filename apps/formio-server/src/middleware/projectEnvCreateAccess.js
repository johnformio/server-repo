'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectEnvCreateAccess');

module.exports = function(formio) {
  return function(req, res, next) {
    if (!('project' in req.body)) {
      debug('Creating project, skip environment checks.');
      return next();
    }

    formio.cache.loadProject(req, req.body.project, function(err, project) {
      if (err) {
        debug(err);
        return res.status(400).send(err);
      }

      if (!project) {
        debug('No Project');
        return res.status(400).send('Environment project doesnt exist.');
      }

      if (req.token && req.token.user._id === project.owner.toString()) {
        debug('Allowing the project owner to add environment.');
        return next();
      }
      else if (req.user) {
        const access = _.map(_.map(_.filter(project.access, {type: 'team_admin'}), 'roles'), formio.util.idToString);
        const roles = _.map(req.user.roles, formio.util.idToString);

        if ( _.intersection(access, roles).length !== 0) {
          debug('Allowing a team_admin user to add environment..');
          return next();
        }
      }

      return res.status(403).send('Permission Denied');
    });
  };
};
