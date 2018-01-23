'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectAccessFilter');

module.exports = function(formio) {
  /**
   * Formio Middleware to ensure that the roles in the project access payload are valid.
   *
   * This middleware will filter all roles that are not part of the project or are not teams that the project owner, owns.
   */
  return function(req, res, next) {
    if (req.method !== 'PUT') {
      return next();
    }
    if (!req.projectId) {
      return res.sendStatus(400);
    }

    req.body = req.body || {};

    // Skip the role check if no access was defined.
    if (!req.body.access || req.body.access && req.body.access.length === 0) {
      return next();
    }

    // All of the valid access ids for this project.
    let accessIds = [];

    // If this is remote access, check the permissions.
    if (req.remotePermission) {
      // Allow access if they have team access.
      if (['admin', 'owner', 'team_admin', 'team_write', 'team_read'].indexOf(req.remotePermission) !== -1) {
        return next();
      }
    }

    // Get the owner of the Project
    formio.cache.loadProject(req, req.projectId, function(err, project) {
      if (err) {
        debug(err);
        return res.sendStatus(400);
      }
      if (!project.owner) {
        return res.sendStatus(500);
      }

      // Search for all roles associated with a project.
      formio.resources.role.model.find({deleted: {$eq: null}, project: project._id.toString()}, function(err, roles) {
        if (err) {
          debug(err);
          return res.sendStatus(400);
        }

        // Update the accessIds with the project roles.
        roles = roles || [];
        roles = _.map(_.map(roles, '_id'), formio.util.idToString);
        accessIds = accessIds.concat(roles);

        /**
         * Filter the access obj in the current request based on the calculated accessIds.
         */
        const filterAccess = function() {
          // Filter each set of roles to only include roles in the accessIds list.
          req.body.access = _.filter(req.body.access, function(permission) {
            permission.roles = permission.roles || [];
            permission.roles = _.intersection(permission.roles, accessIds);
            return permission;
          });
        };

        // Only proceed with teams access check if the project plan supports teams.
        project.plan = project.plan || '';
        if (!(project.plan === 'team' || project.plan === 'commercial' || project.plan === 'trial')) {
          filterAccess();
          return next();
        }

        // Find all the Teams owned by the project owner.
        formio.teams.getTeams(project.owner, false, true)
          .then(function(teams) {
            teams = teams || [];
            teams = _.map(_.map(teams, '_id'), formio.util.idToString);

            accessIds = accessIds.concat(teams);
            accessIds = _.uniq(_.filter(accessIds));

            filterAccess();
            next();
          })
          .catch(function(err) {
            debug(err);

            filterAccess();
            next();
          });
      });
    });
  };
};
