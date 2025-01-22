'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectEnvCreateAccess');

module.exports = function(formio) {
  return async function(req, res, next) {
    if (!('project' in req.body)) {
      return next();
    }

    const checkAccess = async (projectId) => {
      try {
          const project = await formio.cache.loadProject(req, projectId);
          if (!project) {
            throw {
              status: 400,
              err: 'Stage parent project doesnt exist.',
            };
          }

          // If there is no access defined, like on premise stages in separate environment from project.
          if (!project.access) {
            return project;
          }

          if (req.token && req.token.user._id === project.owner.toString()) {
            return project;
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
              return project;
            }
          }
          else if (req.isAdmin) {
            _.set(req, 'body.owner', project.owner || null);
            return project;
          }
          throw {
            status: 403,
            err: 'Permission Denied',
          };
      }
      catch (err) {
        debug(err);
        throw ({status: err.status || 400, err});
      }
    };

    try {
      const project = await checkAccess(req.body.project);
      if (
        req.body.hasOwnProperty('copyFromProject')
        && req.body.copyFromProject !== 'empty'
        && req.body.copyFromProject !== req.body.project
        ) {
          const copyProject = await checkAccess(req.body.copyFromProject);
          if (!copyProject.project || formio.util.idToString(copyProject.project) !== formio.util.idToString(project._id)) {
            throw {
              status: 400,
              err: "Stage parent project doesnt relate to the current project.",
            };
          }
      }
      return next();
    }
    catch (err) {
    return res.status(err.status).send(err.err);
    }
  };
};
