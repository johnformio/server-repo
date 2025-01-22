'use strict';
const Teams = require('./Teams');
const _ = require('lodash');
const maxLength = 254;

module.exports = function(app, formioServer) {
  Teams.init(formioServer);

  // Standardize the responses
  const respondWith = (method, empty) => async (req, res) => {
    let response = empty;
    try {
      response = await method(req);
      if (!response) {
        if (empty) {
          return res.status(200).json(empty);
        }
        else {
          return res.sendStatus(404);
        }
      }
    }
    catch (err) {
      return res.status(400).send(err.message);
    }
    return res.status(200).json(response);
  };

  /**
   * Ensure the user accessing this is authenticated.
   */
  const ensureAuthenticated = async (req, res, next) => {
    if (!req.token || !req.token.user || !formioServer.formio.twoFa.is2FAuthenticated(req)) {
      return res.sendStatus(401);
    }
    const formioProject = await Teams.getFormioProject();
    if (formioProject._id.toString() !== req.token.project._id.toString()) {
      return res.sendStatus(401);
    }
    next();
  };

  /**
   * Ensure a project Id is found in the url.
   * @param req
   * @param res
   * @param next
   */
  const ensureProject = (req, res, next) => {
    if (!req.projectId && req.params.projectId) {
      req.projectId = req.params.projectId;
    }
    if (!req.projectId) {
      return res.sendStatus(401);
    }
    next();
  };

  const initializeTeams = [
    formioServer.formio.middleware.tokenHandler,
    ensureAuthenticated,
  ];

  /**
   * Allow a user with permission to get all the associated projects and roles that
   * the current team is associated with.
   */
  app.get('/team/:teamId/projects',
    ...initializeTeams,
    Teams.teamAccessHandler(false),
    respondWith((req) => Teams.getTeamProjects(req.currentTeam), [])
  );

  /**
   * Allow a user with permissions to get all the teams associated with the given project.
   */
  app.get('/team/project/:projectId',
    ...initializeTeams,
    ensureProject,
    formioServer.formio.middleware.permissionHandler,
    respondWith((req) => Teams.getProjectTeams(req, req.projectId, 'team_'), [])
  );

  /**
   * Allow a user with permissions to get all the teams associated with the given project.
   */
  app.get('/team/stage/:projectId',
    ...initializeTeams,
    ensureProject,
    formioServer.formio.middleware.permissionHandler,
    respondWith((req) => Teams.getProjectTeams(req, req.projectId, 'stage_'), [])
  );

  /**
   * Expose the functionality to find all of a users teams.
   */
  app.get('/team/all',
    ...initializeTeams,
    respondWith((req) => Teams.getTeams(req.user, false), [])
  );

  /**
   * Expose the functionality to find all the teams a user owns.
   */
  app.get('/team/own',
    ...initializeTeams,
    respondWith((req) => Teams.getTeams(req.user, true, true), [])
  );

  /**
   * Create a team.
   */
  app.post('/team', [
      ...initializeTeams,
      formioServer.formio.middleware.permissionHandler,
      require('../middleware/checkPrimaryAccess'),
      Teams.createTeam
    ]
  );

  /**
   * Get a team.
   */
  app.get('/team/:teamId',
    ...initializeTeams,
    Teams.teamAccessHandler(false),
    respondWith((req) => Teams.addMembers(req.currentTeam))
  );

  // Update a team.
  app.put('/team/:teamId',
    ...initializeTeams,
    Teams.teamAccessHandler(true),
    respondWith((req) => Teams.updateTeam(
      req.currentTeam,
      _.get(req.body, 'data.name', ''),
      _.get(req.body, 'metadata.ssoteam', false)
    ))
  );

  // Delete a team.
  app.delete('/team/:teamId',
    ...initializeTeams,
    Teams.teamAccessHandler(true),
    Teams.deleteTeam
  );

  const teamMembershipHandlers = [
    ...initializeTeams,
    Teams.teamAccessHandler(true),
    async (req, res, next) => {
      if (req.method.toLowerCase() === 'post') {
        if (req.body.data.email.length > maxLength) {
          return res.status(400).send('Team member email exceeds allowed character limit');
        }
        else {
          const teamUsers = await Teams.getMembers( _.get(req.body, 'data.team', req.currentTeam));
          const duplicateUser = teamUsers.find((user)=> _.get(user, 'data.email') === _.get(req.body, 'data.email'));
          if (duplicateUser) {
            return res.status(400).send(`Team member with ${_.get(duplicateUser, 'data.email')} email already exists`);
          }
          else {
            return next();
          }
        }
      }
      else {
        return next();
      }
    },
    async (req, res, next) => {
      if (req.method.toLowerCase() === 'put') {
        const member = await Teams.getMemberFromId(req.params.submissionId);
        member.data = {...member.data, ...req.body.data};
        req.body = member;
        req.currentMember = member;
      }
      next();
    },
    Teams.teamMembershipHandler(null, null, true)
  ];
  /**
   * Add a new team member.
   */
  app.post('/team/:teamId/member', Teams.filterForSSOTeams, ...teamMembershipHandlers);
  app.get('/team/:teamId/member/:submissionId', ...teamMembershipHandlers);
  app.put('/team/:teamId/member/:submissionId', ...teamMembershipHandlers);
  app.delete('/team/:teamId/member/:submissionId',
    ...initializeTeams,
    Teams.filterForSSOTeams,
    Teams.teamAccessHandler(true),
    async (req, res, next) => {
      req.currentMember = await Teams.getMemberFromId(req.params.submissionId);
      next();
    },
    (req, res) => Teams.removeTeamMembershipHandler(req.currentTeam, req.currentMember, req, res, true)
  );

  /**
   * Expose the functionality to allow a user join or leave a team.
   */
  app.post('/team/:teamId/join',
    ...initializeTeams,
    Teams.filterForSSOTeams,
    Teams.teamAccessHandler(false),
    Teams.currentMemberHandler,
    async (req, res) => {
      await Teams.acceptTeam(req.user, req.currentMember, req.currentTeam);
      res.status(200).json(req.currentMember);
    }
  );
  app.post('/team/:teamId/leave',
    ...initializeTeams,
    Teams.filterForSSOTeams,
    Teams.teamAccessHandler(false),
    Teams.currentMemberHandler,
    (req, res) => Teams.removeTeamMembershipHandler(req.currentTeam, req.currentMember, req, res, true)
  );

  return Teams;
};
