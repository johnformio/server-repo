'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectAccessFilter');
const EVERYONE = '000000000000000000000000';

module.exports = function(formio) {
  /**
   * Formio Middleware to ensure that the roles in the project access payload are valid.
   *
   * This middleware will filter all roles that are not part of the project or are not teams that the project owner, owns.
   */
  return async function(req, res, next) {
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
      if ([
        'admin',
        'owner',
        'team_admin',
        'team_write',
        'team_read',
        'team_access'
      ].indexOf(req.remotePermission) !== -1) {
        return next();
      }
    }

    // Get the owner of the Project
    try {
      const project = await formio.cache.loadProject(req, req.projectId);

      if (!project.owner) {
        return res.sendStatus(400);
      }

      // Search for all roles associated with a project.
        let roles = await formio.resources.role.model.find({deleted: {$eq: null}, project: project._id.toString()});
        // Update the accessIds with the project roles.
        roles = roles || [];
        roles = _.map(_.map(roles, '_id'), formio.util.idToString);
        accessIds = accessIds.concat(roles);

        // Support for Everyone role
        accessIds.push(EVERYONE);

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

        // Get the current teams
        let currentTeams = [];
        project.access.forEach(access => {
          if (access.type.indexOf('team_') === 0 || access.type.indexOf('stage_') === 0) {
            currentTeams = currentTeams.concat(_.map(access.roles, formio.util.idToString));
          }
        });

        // Find all the Teams for the current user.
        try {
          let teams = await formio.teams.getTeams(req.user, false, true);
          teams = teams || [];
          teams = _.map(_.map(teams, '_id'), formio.util.idToString);

          accessIds = accessIds.concat(currentTeams).concat(teams);
          accessIds = _.uniq(_.filter(accessIds));

          filterAccess();
          return next();
        }
        catch (err) {
          debug(err);

          filterAccess();
          return next();
        }
    }
    catch (err) {
      debug(err);
      return res.sendStatus(400);
    }
  };
};
