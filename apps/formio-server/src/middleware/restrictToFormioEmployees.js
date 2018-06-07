'use strict';
const _ = require('lodash');
module.exports = function(formio) {
  return (req, res, next) => {
    if (!req.user) {
      return res.sendStatus(401);
    }

    formio.cache.loadProjectByName(req, 'formio', (err, project) => {
      if (err || !project) {
        return res.sendStatus(401);
      }

      try {
        project = project.toObject();
      }
      catch (err) {
        // project was already a plain js object.
      }

      // Owner of Formio
      if (req.user._id.toString() === project.owner.toString()) {
        return next();
      }

      formio.resources.role.model.findOne({
        project: project._id,
        title: "Administrator",
        deleted: {$eq: null}
      }, (err, response) => {
        if (!err && response) {
          // Admin of Formio.
          if (req.user.roles.indexOf(response.toObject()._id) !== -1) {
            return next();
          }
        }
        // Team member of Formio.
        formio.teams.getProjectTeams(req, project._id, (err, teams, permissions) => {
          if (err || !teams || !permissions) {
            return res.sendStatus(401);
          }

          const member = _.some(teams, (team) => {
            if (req.user.roles.indexOf(team) !== -1) {
              return true;
            }

            return false;
          });

          if (member) {
            return next();
          }

          return res.sendStatus(401);
        });
      });
    });
  };
};
