'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectTeamSync');

module.exports = function(formio) {
  const replaceAccess = (project, access) => {
    if ('toObject' in access.roles) {
      access.roles = access.roles.toObject();
    }
    access.roles = _.map(access.roles, id => id.toString());

    let found = false;
    project.access.forEach(projectAccess => {
      if (projectAccess.type === access.type) {
        found= true;
        projectAccess.roles = [...access.roles];
      }
    });
    if (!found) {
      project.access = project.access.concat(access);
    }
  };

  return function(req, res, next) {
    // Creating/Modifying a project.
    if (!('project' in req.body) || !req.body.project) {
      // Only update when modifying a project. When creating a project, there are no stages.
      if (req.method === 'PUT') {
        const teamAccess = _.filter(req.body.access || [], access => _.startsWith(access.type, 'team_'));

        formio.cache.loadStages(req, req.body._id, (err, result) => {
          if (err) {
            return next(err);
          }

          result.forEach(stage => {
            const stageAccess = {access: stage.access.toObject()};
            teamAccess.forEach(access => replaceAccess(stageAccess, access));
            formio.mongoose.models.project.updateOne({
              _id: stage._id
            },
            {$set: {access: stageAccess.access}})
            .then((res)=>{});
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
      formio.cache.loadProject(req, req.body.project, function(err, project) {
        if (err || !project || !project.access) {
          debug(err || 'No Project');
          return next();
        }

        const teamAccess = _.filter(project.access, access => _.startsWith(access.type, 'team_'));
        req.body.access = req.body.access || [];
        teamAccess.forEach(access => replaceAccess(req.body, access));

        return next();
      });
    }
  };
};
