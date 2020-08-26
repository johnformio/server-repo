'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectEnvCreateAccess');

module.exports = function(formio) {
  return function(req, res, next) {
    if (!('project' in req.body)) {
      return next();
    }

    formio.cache.loadProject(req, req.body.project, function(err, project) {
      if (err) {
        debug(err);
        return res.status(400).send(err);
      }

      if (!project) {
        return res.status(400).send('Stage parent project doesnt exist.');
      }

      // If there is no access defined, like on premise stages in separate environment from project.
      if (!project.access) {
        return next();
      }

      if (req.token && req.token.user._id === project.owner.toString()) {
        return next();
      }
      else if (req.user) {
        const access = _.chain(project.access)
          .filter({type: 'team_admin'})
          .head()
          .get('roles', [])
          .map(formio.util.idToString)
          .value();
        const roles = _.map(req.user.teams, formio.util.idToString);

        if ( _.intersection(access, roles).length !== 0) {
          return next();
        }
      }

      return res.status(403).send('Permission Denied');
    });
  };
};
