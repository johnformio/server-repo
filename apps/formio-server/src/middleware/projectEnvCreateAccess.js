'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectEnvCreateAccess');

module.exports = function(formio) {
  return function(req, res, next) {
    if (!('project' in req.body)) {
      return next();
    }

    const checkAccess = (projectId) => {
      return new Promise((resolve, reject) => {
        formio.cache.loadProject(req, projectId, function(err, project) {
          if (err) {
            debug(err);
            return reject({status: 400, err});
          }

          if (!project) {
            return reject({status: 400, err: 'Stage parent project doesnt exist.'});
          }

          // If there is no access defined, like on premise stages in separate environment from project.
          if (!project.access) {
            return resolve(project);
          }

          if (req.token && req.token.user._id === project.owner.toString()) {
            return resolve(project);
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
              return resolve(project);
            }
          }
          else if (req.isAdmin) {
            return resolve(project);
          }
          return reject({status: 403, err: 'Permission Denied'});
        });
      });
    };

    checkAccess(req.body.project)
      .then((project) => {
        if (
          req.body.hasOwnProperty('copyFromProject')
          && req.body.copyFromProject !== 'empty'
          && req.body.copyFromProject !== req.body.project
          ) {
          return checkAccess(req.body.copyFromProject).then((copyProject) => {
            if (!copyProject.project || formio.util.idToString(copyProject.project) !== formio.util.idToString(project._id)) {
              throw {
                status: 400,
                err: "Stage parent project doesnt relate to the current project.",
              };
            }
          });
        }
      })
      .then(() => {
        return next();
      })
      .catch((err) => {
        return res.status(err.status).send(err.err);
      });
  };
};
