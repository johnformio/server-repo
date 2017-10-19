'use strict';

var _ = require('lodash');
var debug = require('debug')('formio:middleware:projectTeamSync');

module.exports = function(formio) {
  const cache = require('../cache/cache')(formio);

  const replaceAccess = (project, access) => {
    if ('toObject' in access.roles) {
      access.roles = access.roles.toObject();
    }
    access.roles = access.roles.map(id => id.toString());

    let found = false;
    project.access.forEach(projectAccess => {
      if (projectAccess.type === access.type) {
        projectAccess.roles = access.roles;
      }
    });
    if (!found) {
      project.access = project.access.concat(access);
    }
  };

  return function(req, res, next) {
    // Creating/Modifying a project.
    if (!('project' in req.body)) {
      // Only update when modifying a project. When creating a project, there are no stages.
      if (req.method === 'PUT') {
        debug('modifying project.');
        req.body.access = req.body.access || [];
        const teamAccess = _.filter(req.body.access, access => _.startsWith(access.type, 'team_'));

        cache.loadStages(req, req.body._id, (err, result) => {
          if (err) {
            return next(err);
          }

          result.forEach(stage => {
            let stageAccess = {access: stage.access.toObject()};
            teamAccess.forEach(access => replaceAccess(stageAccess, access));
            stage.set('access', stageAccess.access);
            stage.save();
          });
          return next();
        });
      }
      else {
        return next();
      }
    }
    // Creating/Modifying a stage.
    else {
      debug('creating or modifying stage.');
      cache.loadProject(req, req.body.project, function(err, project) {
        if (err || !project) {
          debug(err || 'No Project');
          return next();
        }

        const teamAccess = _.filter(project.access.toObject(), access => _.startsWith(access.type, 'team_'));
        req.body.access = req.body.access || [];
        teamAccess.forEach(access => replaceAccess(req.body, access));

        return next();
      });
    }
  };
};
