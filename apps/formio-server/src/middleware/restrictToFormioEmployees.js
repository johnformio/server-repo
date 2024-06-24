'use strict';
const _ = require('lodash');
module.exports = function(formio) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.sendStatus(401);
    }

    try {
      const project = await formio.cache.loadProjectByName(req, 'formio');
      if (!project) {
        return res.sendStatus(401);
      }

      // Owner of Formio
      if (req.user._id.toString() === project.owner.toString()) {
        return next();
      }

      try {
        const response = await formio.resources.role.model.findOne({
        project: formio.util.idToBson(project._id),
        title: "Administrator",
        deleted: {$eq: null}
      });

      if (response) {
        // Admin of Formio.
        if (req.user.roles.indexOf(response.toObject()._id) !== -1) {
          return next();
        }
      }
    }
    catch (err) {
        // Team member of Formio.
        formio.teams.getProjectTeams(req, project._id, 'team_', (err, teams, permissions) => {
          if (err || !teams || !permissions) {
            return res.sendStatus(401);
          }

          const member = _.some(teams, (team) => {
            if (req.user.teams.indexOf(team) !== -1) {
              return true;
            }

            return false;
          });

          if (member) {
            return next();
          }

          return res.sendStatus(401);
        });
      }
    }
    catch (err) {
      return res.sendStatus(401);
    }
  };
};
