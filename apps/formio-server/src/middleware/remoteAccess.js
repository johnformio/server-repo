'use strict';

const jwt = require('jsonwebtoken');
const _ = require('lodash');

module.exports = app => (req, res, next) => {
  const response = {
    project: {},
    permission: 'none',
    user: _.pick(req.user, ['_id', 'data.name', 'data.email', 'created', 'modified'])
  };

  // Permission heirarchy.
  const permissions = ['none', 'team_access', 'team_read', 'team_write', 'team_admin', 'owner'];

  app.formio.cache.loadCurrentProject(req, function(err, project) {
    response.project = {
      _id: project._id,
      title: project.title,
      name: project.name,
      owner: project.owner
    };

    // If user is owner, skip other checks.
    if (app.formio.util.idToString(project.owner) === req.token.user._id) {
      response.permission = 'owner';
    }
    else {
      project.access.forEach(access => {
        if (_.startsWith(access.type, 'team_') || _.startsWith(access.type, 'stage_')) {
          const roles = access.roles.map(role => role.toString());
          const type = access.type.replace('stage_', 'team_');
          roles.forEach(role => {
            if (
              req.user.teams.indexOf(role) &&
              permissions.indexOf(type) > permissions.indexOf(response.permission)
            ) {
              response.permission = type;
            }
          });
        }
      });
    }

    // Delete the expiration.
    delete response.exp;

    return res.status(200).send(jwt.sign(response, project.settings.remoteSecret, {
      expiresIn: app.formio.config.jwt.expireTime * 60
    }));
  });
};
