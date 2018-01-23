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
        return res.status(400).send('Environment project doesnt exist.');
      }

      if (req.token && req.token.user._id === project.owner.toString()) {
        return next();
      }
      else if (req.user) {
        const access = _.map(_.map(_.filter(project.access, {type: 'team_admin'}), 'roles'), formio.util.idToString);
        const roles = _.map(req.user.roles, formio.util.idToString);

        if ( _.intersection(access, roles).length !== 0) {
          return next();
        }
      }

      return res.status(403).send('Permission Denied');
    });
  };
};
