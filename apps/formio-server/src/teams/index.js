'use strict';

const _ = require('lodash');
const Q = require('q');
const debug = {
  error: require('debug')('formio:error'),
  teamUsers: require('debug')('formio:teams:teamUsers'),
  teamAll: require('debug')('formio:teams:teamAll'),
  teamProjects: require('debug')('formio:teams:teamProjects'),
  teamOwn: require('debug')('formio:teams:teamOwn'),
  leaveTeams: require('debug')('formio:teams:leaveTeams'),
  loadUsers: require('debug')('formio:teams:loadUsers'),
  loadTeams: require('debug')('formio:teams:loadTeams'),
  getTeams: require('debug')('formio:teams:getTeams'),
  getProjectTeams: require('debug')('formio:teams:getProjectTeams'),
  getProjectPermission: require('debug')('formio:teams:getProjectPermission'),
  getDisplayableTeams: require('debug')('formio:teams:getDisplayableTeams'),
  filterTeamsForDisplay: require('debug')('formio:teams:filterTeamsForDisplay')
};

module.exports = function(app, formioServer) {
  // The formio teams resource id.
  let teamResource = null;
  // The formio user resource id.
  let _userResource = null;

  /**
   * Reset Cache for testing
   */
  const resetTeams = function() {
    teamResource = null;
    _userResource = null;
  };

  /**
   * Get the given teams permissions within the given project.
   *
   * @param project {Object}
   *   The project object.
   * @param team {String|Object}
   *   The given team to search for.
   *
   * @returns {String}
   *   The permission that the given team has within the given project.
   */
  const getProjectPermission = function(project, team) {
    project.access = project.access || [];

    // Get the permission type starting with team_.
    const type = _.filter(project.access, function(access) {
      access.type = access.type || '';
      access.roles = access.roles || [];
      access.roles = _.map(access.roles, formioServer.formio.util.idToString);

      const starts = _.startsWith(access.type, 'team_');
      const contains = _.includes(access.roles, formioServer.formio.util.idToString(team));
      return starts && contains;
    });
    debug.getProjectPermission(type);

    // A team should never have more than one permission.
    if (type.length > 1) {
      /* eslint-disable no-console */
      console.error(
        `The given project: ${
         project._id
         }\n has a team with more than one permission: ${team}`
      );
      /* eslint-enable no-console */

      // Return the highest access permission.
      const permissions = _.map(type, 'type');
      debug.getProjectPermission(permissions);

      if (_.includes(permissions, 'team_admin')) {
        return 'team_admin';
      }
      if (_.includes(permissions, 'team_write')) {
        return 'team_write';
      }
      if (_.includes(permissions, 'team_read')) {
        return 'team_read';
      }
      if (_.includes(permissions, 'team_access')) {
        return 'team_access';
      }
    }

    return type[0].type || '';
  };

  /**
   * Utility function to load the formio team resource.
   *
   * @param next {Function}
   *   The callback to invoke once the teams resource is loaded.
   */
  const loadTeams = function(next) {
    if (teamResource) {
      return next(teamResource);
    }

    formioServer.formio.resources.project.model.findOne({name: 'formio'}).lean().exec((err, formio) => {
      if (err || !formio) {
        debug.loadTeams(err);
        return next(null);
      }

      debug.loadTeams(`formio project: ${formio._id}`);
      formioServer.formio.resources.form.model.findOne({name: 'team', project: formio._id})
        .lean().exec(function(err, resource) {
          if (err || !resource || !resource._id) {
            debug.loadTeams(err);
            return next(null);
          }

          debug.loadTeams(`team resource: ${resource._id}`);
          teamResource = resource;
          return next(teamResource);
        });
    });
  };

  /**
   * Utility function to load the formio user resource.
   *
   * @param next {Function}
   *   The callback to invoke once the user resource is loaded.
   */
  const loadUsers = function(next) {
    if (_userResource) {
      return next(_userResource);
    }

    formioServer.formio.resources.project.model.findOne({name: 'formio'}).lean().exec((err, formio) => {
      if (err || !formio) {
        debug.loadUsers(err);
        return next(null);
      }

      debug.loadUsers(`formio project: ${formio._id}`);
      formioServer.formio.resources.form.model.findOne({name: 'user', project: formio._id})
        .lean().exec(function(err, userResource) {
          if (err || !userResource) {
            debug.loadUsers(err);
            return next(null);
          }

          debug.loadUsers(`user resource: ${userResource._id}`);
          _userResource = userResource._id;
          return next(_userResource);
        });
    });
  };

  /**
   * Get the teams that the given user is associated with.
   *
   * @param user {Object|String}
   *   The user Submission object or user _id.
   * @param member {Boolean}
   *   Determines if the query should include teams the given user is a member of.
   * @param owner {Boolean}
   *   Determines if the query should include teams owned buy the given user.
   *
   * @returns {Promise}
   */
  const getTeams = function(user, member, owner) {
    const util = formioServer.formio.util;
    const q = Q.defer();

    loadTeams(function(resource) {
      // Skip the teams functionality if no user or resource is found.
      if (!resource) {
        return q.resolve([]);
      }
      if (!user || user.hasOwnProperty('_id') && !user._id) {
        debug.getTeams(user);
        return q.reject('No user given.');
      }

      // Only allow users who belong to the same project as the team resource.
      if (!user.project || (user.project.toString() !== resource.project.toString())) {
        return q.resolve([]);
      }

      // Force the user ref to be the _id.
      user = user._id || user;

      // Build the search query for teams.
      const query = {
        form: resource._id,
        deleted: {$eq: null}
      };

      // If the portal is with SSO and the user has teams in their array, perform a one-to-one mapping between
      // the users teams and the titles of the teams they are added to.
      if (formioServer.config.portalSSO && user.teams) {
        query.name = {$in: user.teams};
      }
      else {
        // Modify the search query based on the given criteria, search for BSON and string versions of ids.
        debug.getTeams(`User: ${util.idToString(user)}, Member: ${member}, Owner: ${owner}`);
        if (member && owner) {
          query['$or'] = [
            {'data.members': {$elemMatch: {_id: {$in: [util.idToBson(user), util.idToString(user)]}}}},
            {'data.admins': {$elemMatch: {_id: {$in: [util.idToBson(user), util.idToString(user)]}}}},
            {owner: {$in: [util.idToBson(user), util.idToString(user)]}}
          ];
        }
        else if (member && !owner) {
          query['data.members'] = {$elemMatch: {_id: {$in: [util.idToBson(user), util.idToString(user)]}}};
        }
        else if (!member && owner) {
          query['$or'] = [
            {'owner': {$in: [util.idToBson(user), util.idToString(user)]}},
            {'data.admins': {$elemMatch: {_id: {$in: [util.idToBson(user), util.idToString(user)]}}}}
          ];
        }
        else {
          // Fail safely for incorrect usage of getTeams.
          debug.getTeams('Could not build team query because given parameters were incorrect.');
          return q.resolve([]);
        }
      }

      formioServer.formio.resources.submission.model.find(query).lean().exec((err, documents) => {
        if (err) {
          debug.getTeams(err);
          return q.reject(err);
        }

        // Add the user as a member of the team if they have this from SSO.
        if (formioServer.config.portalSSO && user.teams) {
          documents.forEach((doc) => {
            doc.data = {
              members: [user._id.toString()],
              admins: []
            };
          });
        }

        return q.resolve(documents || []);
      });
    });

    return q.promise;
  };

  /**
   * Get all the teams associated with the given project.
   *
   * @param req {Object}
   *   The express request object.
   * @param project {String|Object}
   *   The project object or _id to search for the associated teams.
   * @param next {Function}
   *   The callback function to invoke after getting the project teams.
   */
  const getProjectTeams = function(req, project, type, next) {
    if (!project || project.hasOwnProperty('_id') && !project._id) {
      debug.getProjectTeams('No project given to find its teams.');
      return next('No project given.');
    }

    project = project._id || project;
    formioServer.formio.cache.loadProject(req, project, function(err, project) {
      if (err) {
        debug.getProjectTeams(err);
        return next(err);
      }

      // Get the teams and their access.
      let teams = _.filter(project.access, function(permission) {
        if (_.startsWith(permission.type, type)) {
          return true;
        }

        return false;
      });
      debug.getProjectTeams(teams);

      // Build the team:permission map.
      const permissions = {};
      _.each(teams, function(permission) {
        // Iterate each permission role and associate it with the original permission type.
        permission.roles = permission.roles || [];
        _.each(permission.roles, function(role) {
          permissions[role] = permission.type;
        });
      });
      debug.getProjectTeams(permissions);

      // Separate the teams from their roles for a flat list, and convert to strings for comparison.
      teams = _.map(teams, 'roles');
      teams = _.flatten(teams);
      teams = teams || [];
      teams = _.map(teams, formioServer.formio.util.idToString);
      debug.getProjectTeams(teams);

      next(null, teams, permissions);
    });
  };

  /**
   * Converts team _ids into visible team information.
   *
   * @param teams {Object|Array}
   *   A team _id or array of team _ids to be converted into displayable information.
   *
   * @returns {Promise}
   */
  const getDisplayableTeams = function(teams) {
    const util = formioServer.formio.util;
    const q = Q.defer();

    loadTeams(function(resource) {
      // Skip the teams functionality if no user or resource is found.
      if (!resource) {
        return q.reject('No team resource found.');
      }
      if (!teams || teams.hasOwnProperty('_id') && !teams._id) {
        debug.getDisplayableTeams(teams);
        return q.reject('No project given.');
      }

      // Force the teams ref to be an array of team ids.
      debug.getDisplayableTeams(teams);
      if (teams instanceof Array) {
        teams = _.map(teams, function(team) {
          const _id = team._id || team;
          return util.idToString(_id);
        });
      }
      else {
        teams = [teams._id] || [teams];
      }

      // Flatten the list of teams, and build the query to include string and BSON ids.
      teams = _.filter(teams);
      teams = _.flattenDeep(_.map(teams, function(team) {
        return [util.idToString(team), util.idToBson(team)];
      }));
      debug.getDisplayableTeams(teams);

      // Build the search query for teams.
      const query = {
        form: resource._id,
        deleted: {$eq: null},
        _id: {$in: teams}
      };

      formioServer.formio.resources.submission.model.find(query).lean().exec((err, documents) => {
        if (err) {
          debug.getDisplayableTeams(err);
          return q.reject(err);
        }

        // Coerce results into an array and return the teams as objects.
        debug.getDisplayableTeams(documents);
        return q.resolve(documents);
      });
    });

    return q.promise;
  };

  /**
   * Filter submission results for a team.
   *
   * @param teams {Object|Array}
   *   The results of a single (or multiple) team that should be filtered for end user consumption.
   *
   * @return {Object|Array}
   *   The filtered results.
   */
  const filterTeamsForDisplay = function(teams) {
    let singleTeam = false;

    if (!teams) {
      debug.filterTeamsForDisplay('No teams given');
      return [];
    }
    if (!(teams instanceof Array)) {
      singleTeam = true;
      teams = [teams];
    }

    teams = teams || [];
    teams = _.map(teams, function(team) {
      try {
        team = team.toObject();
      }
      catch (e) {
        debug.error(e);
      }

      team = team || {};
      team.data = team.data || {};
      team.data.name = team.data.name || '';
      team.data.members = team.data.members || [];
      team.data.admins = team.data.admins || [];

      // The sanitized version of the team.
      return {
        _id: team._id || '',
        owner: team.owner || '',
        data: {
          name: team.data.name || '',
          members: _.map(team.data.members, function(member) {
            return {
              _id: member._id,
              name: member.name
            };
          }),
          admins: _.map(team.data.admins, function(member) {
            return {
              _id: member._id,
              name: member.name
            };
          })
        }
      };
    });

    // Unwrap the single team, if flagged before filtering.
    if (singleTeam) {
      teams = teams[0];
    }

    debug.filterTeamsForDisplay(teams);
    return teams;
  };

  /**
   * Allow a user with permission to get all the associated projects and roles that the current team is associated with.
   */
  app.get('/team/:teamId/projects', formioServer.formio.middleware.tokenHandler, function(req, res, next) {
    if (!req.params.teamId) {
      debug.teamProjects('Skipping, no teamId given');
      return res.sendStatus(400);
    }

    const _team = req.params.teamId;
    const query = {
      $and: [
        {$or: [
          {'access.type': 'team_access'},
          {'access.type': 'team_read'},
          {'access.type': 'team_write'},
          {'access.type': 'team_admin'}
        ]},
        {'access.roles': {$in: [formioServer.formio.util.idToString(_team), formioServer.formio.util.idToBson(_team)]}},
        {project: null}
      ],
      deleted: {$eq: null}
    };

    debug.teamProjects(query);
    formioServer.formio.resources.project.model.find(query).lean().exec((err, projects) => {
      if (err) {
        debug.teamProjects(err);
        return res.sendStatus(400);
      }

      const response = [];
      _.each(projects, function(project) {
        response.push({
          _id: project._id,
          title: project.title,
          name: project.name,
          owner: project.owner,
          permission: getProjectPermission(project, _team)
        });
      });

      debug.teamProjects(response);
      return res.status(200).json(response);
    });
  });

  /**
   * Allow all formio users to be able to query the existing users available for teams.
   */
  app.get(
    '/team/members',
    formioServer.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.token || !req.token.user._id) {
        return res.sendStatus(401);
      }

      let query = req.query || null;
      if (!query) {
        return res.status(400).send('A search query is required.');
      }
      else if (!query.name) {
        return res.status(400).send('Expected a query of type: `name`');
      }
      else {
        query = new RegExp(query.name, 'i');
      }

      loadUsers(function(users) {
        // limit the query results and sort them by name accuracy.
        formioServer.formio.resources.submission.model
          .find({deleted: {$eq: null}, form: users, 'data.name': {$regex: query}})
          .sort({'data.name': 1})
          .limit(10)
          .lean()
          .exec(function(err, users) {
            if (err) {
              debug.teamUsers(err);
              return res.sendStatus(400);
            }

            debug.teamUsers(users);
            const clean = _.map(users, function(user) {
              user.data = user.data || {};

              return {
                _id: user._id || '',
                data: {
                  name: user.data.name || ''
                }
              };
            });

            debug.teamUsers(clean);
            return res.status(200).json(clean);
          });
      });
    }
  );

  /**
   * Allow a user with permissions to get all the teams associated with the given project.
   */
  app.get(
    '/team/project/:projectId',
    formioServer.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }

      next();
    },
    formioServer.formio.middleware.permissionHandler,
    function(req, res, next) {
      if (!req.projectId) {
        return res.sendStatus(401);
      }

      getProjectTeams(req, req.projectId, 'team_', function(err, teams, permissions) {
        if (err) {
          return res.sendStatus(400);
        }
        if (!teams) {
          return res.status(200).json([]);
        }

        getDisplayableTeams(teams)
          .then(function(teams) {
            return filterTeamsForDisplay(teams);
          })
          .then(function(teams) {
            // Inject the original team permissions with each team.
            teams = _.each(teams, function(team) {
              if (team._id && permissions[team._id]) {
                team.permission = permissions[team._id];
              }

              return team;
            });

            return res.status(200).json(teams);
          })
          .catch(function() {
            return res.sendStatus(400);
          });
      });
    }
  );

  /**
   * Allow a user with permissions to get all the teams associated with the given project.
   */
  app.get(
    '/team/stage/:projectId',
    formioServer.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }

      next();
    },
    formioServer.formio.middleware.permissionHandler,
    function(req, res, next) {
      if (!req.projectId) {
        return res.sendStatus(401);
      }

      getProjectTeams(req, req.projectId, 'stage_', function(err, teams, permissions) {
        if (err) {
          return res.sendStatus(400);
        }
        if (!teams) {
          return res.status(200).json([]);
        }

        getDisplayableTeams(teams)
          .then(function(teams) {
            return filterTeamsForDisplay(teams);
          })
          .then(function(teams) {
            // Inject the original team permissions with each team.
            teams = _.each(teams, function(team) {
              if (team._id && permissions[team._id]) {
                team.permission = permissions[team._id];
              }

              return team;
            });

            return res.status(200).json(teams);
          })
          .catch(function() {
            return res.sendStatus(400);
          });
      });
    }
  );

  /**
   * Expose the functionality to find all of a users teams.
   */
  app.get('/team/all', formioServer.formio.middleware.tokenHandler, function(req, res, next) {
    if (!req.token || !req.token.user._id) {
      return res.sendStatus(401);
    }

    getTeams({
      _id: req.token.user._id,
      project: req.token.project._id
    }, true, true)
      .then(function(teams) {
        teams = teams || [];
        teams = filterTeamsForDisplay(teams);

        debug.teamAll(teams);
        return res.status(200).json(teams);
      })
      .catch(function(err) {
        debug.teamAll(err);
        return res.sendStatus(400);
      });
  });

  /**
   * Expose the functionality to find all the teams a user owns.
   */
  app.get('/team/own', formioServer.formio.middleware.tokenHandler, function(req, res, next) {
    if (!req.token || !req.token.user._id) {
      return res.sendStatus(401);
    }

    getTeams({
      _id: req.token.user._id,
      project: req.token.project._id
    }, false, true)
      .then(function(teams) {
        teams = teams || [];
        teams = filterTeamsForDisplay(teams);

        debug.teamOwn(teams);
        return res.status(200).json(teams);
      })
      .catch(function(err) {
        debug.teamOwn(err);
        return res.sendStatus(400);
      });
  });

  /**
   * Expose the functionality to allow a user leave a team.
   */
  app.post('/team/:teamId/leave', formioServer.formio.middleware.tokenHandler, function(req, res, next) {
    const util = formioServer.formio.util;

    if (!req.token || !req.token.user._id || !req.params.teamId) {
      return res.sendStatus(401);
    }

    loadTeams(function(resource) {
      if (!resource) {
        return res.sendStatus(400);
      }

      // Search for the given team, and check if the current user is a member, but not the owner.
      const query = {
        form: resource._id,
        'data.members': {
          $elemMatch: {_id: {$in: [util.idToBson(req.token.user._id), util.idToString(req.token.user._id)]}}
        },
        deleted: {$eq: null}
      };

      formioServer.formio.resources.submission.model.findOne(query).exec((err, document) => {
        if (err || !document) {
          debug.leaveTeams(err);
          return res.sendStatus(400);
        }

        // Omit the given user from the members list.
        debug.leaveTeams(document);
        document.data = document.data || {};
        document.data.members = document.data.members || [];

        // Convert each _id to strings for comparison.
        document.data.members = _.map(document.data.members, function(element) {
          if (element._id) {
            element._id = util.idToString(element._id);
          }

          return element;
        });

        // Filter the _ids.
        document.data.members = _.uniq(_.reject(document.data.members, {_id: util.idToString(req.token.user._id)}));

        // Convert each _id to strings for comparison.
        document.data.members = _.map(document.data.members, function(element) {
          if (element._id) {
            element._id = util.idToBson(element._id);
          }

          return element;
        });

        // Save the updated team.
        document.markModified('data.members');
        document.save(function(err, update) {
          if (err) {
            debug.leaveTeams(err);
            return res.sendStatus(400);
          }

          debug.leaveTeams(update);
          return res.sendStatus(200);
        });
      });
    });
  });

  return {
    getTeams: getTeams,
    getProjectTeams: getProjectTeams,
    getDisplayableTeams: getDisplayableTeams,
    filterTeamsForDisplay: filterTeamsForDisplay,
    resetTeams: resetTeams
  };
};
