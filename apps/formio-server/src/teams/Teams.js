'use strict';

const _ = require('lodash');
const debug = {
  error: require('debug')('formio:error'),
  teamUsers: require('debug')('formio:teams:teamUsers'),
  teamAll: require('debug')('formio:teams:teamAll'),
  teamProjects: require('debug')('formio:teams:teamProjects'),
  teamOwn: require('debug')('formio:teams:teamOwn'),
  leaveTeams: require('debug')('formio:teams:leaveTeams'),
  getFormioProject: require('debug')('formio:teams:getFormioProject'),
  getUserResource: require('debug')('formio:teams:getUserResource'),
  getTeamResource: require('debug')('formio:teams:getTeamResource'),
  getMemberResource: require('debug')('formio:teams:getMemberResource'),
  getTeams: require('debug')('formio:teams:getTeams'),
  getProjectTeams: require('debug')('formio:teams:getProjectTeams'),
  getProjectPermission: require('debug')('formio:teams:getProjectPermission'),
  loadTeams: require('debug')('formio:teams:loadTeams')
};

const Teams = {
  formioProject: null,
  teamResource: null,
  memberResource: null,
  userResource: null,

  init(formioServer) {
    Teams.projectModel = () => formioServer.formio.resources.project.model;
    Teams.formModel = () => formioServer.formio.resources.form.model;
    Teams.submissionModel = () => formioServer.formio.resources.submission.model;
    Teams.util = () => formioServer.formio.util;
    Teams.cache = () => formioServer.formio.cache;
    Teams.resourcejs = () => formioServer.resourcejs;
  },

  /**
   * Resets all the project settings.
   */
  resetTeams() {
    Teams.formioProject = null;
    Teams.teamResource = null;
    Teams.memberResource = null;
    Teams.userResource = null;
  },

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
  getProjectPermission(project, team) {
    project.access = project.access || [];

    // Get the permission type starting with team_.
    const type = _.filter(project.access, function(access) {
      access.type = access.type || '';
      access.roles = access.roles || [];
      access.roles = _.map(access.roles, Teams.util().idToString);
      const starts = _.startsWith(access.type, 'team_');
      const contains = _.includes(access.roles, Teams.util().idToString(team));
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
  },

  /**
   * Returns the Portal Base project.
   */
  async getFormioProject() {
    if (Teams.formioProject) {
      return Teams.formioProject;
    }
    Teams.formioProject = await Teams.projectModel().findOne({
      name: 'formio'
    }).lean().exec();

    if (Teams.formioProject) {
      debug.getFormioProject(`formio project: ${Teams.formioProject._id}`);
    }
    else {
      debug.getFormioProject('formio project: Not Found');
    }
    return Teams.formioProject;
  },

  /**
   * Gets the team resource form.
   */
  async getTeamResource() {
    if (Teams.teamResource) {
      return Teams.teamResource;
    }
    const formio = await Teams.getFormioProject();
    Teams.teamResource = await Teams.formModel().findOne({name: 'team', project: formio._id}).lean().exec();
    debug.getTeamResource(`team resource: ${Teams.teamResource._id}`);
    return Teams.teamResource;
  },

  /**
   * Gets the member resource form.
   */
  async getMemberResource() {
    if (Teams.memberResource) {
      return Teams.memberResource;
    }
    const formio = await Teams.getFormioProject();

    if (!formio) {
      return null;
    }

    Teams.memberResource = await Teams.formModel().findOne({name: 'member', project: formio._id}).lean().exec();
    debug.getMemberResource(`member resource: ${Teams.memberResource._id}`);
    return Teams.memberResource;
  },

  /**
   * Gets the user resource form.
   */
  async getUserResource() {
    if (Teams.userResource) {
      return Teams.userResource;
    }
    const formio = await Teams.getFormioProject();
    Teams.userResource = await Teams.formModel().findOne({name: 'user', project: formio._id}).lean().exec();
    debug.getUserResource(`user resource: ${Teams.userResource._id}`);
    return Teams.userResource;
  },

  /**
   * Get the teams by name.
   */
  async getSSOTeams(user, names) {
    // Legacy sso teams method.
    if (names && names.length) {
      const teamResource = await Teams.getTeamResource();
      const teams = await Teams.submissionModel().find({
        form: teamResource._id,
        deleted: {$eq: null},
        'data.name': {$in: names},
        'metadata.ssoteam': true
      }).lean().exec();
      if (teams && teams.length) {
        return teams;
      }
    }

    // User new teams method.
    return this.getTeams(user);
  },

  /**
   * Accept a team.
   *
   * @param user - The user object to accept.
   * @param team - The team to accept.
   * @return {Promise<{_id}|*>}
   */
  async acceptTeam(user, member, team) {
    if (!user || !user._id) {
      return;
    }
    const userResource = await Teams.getUserResource();
    const memberResource = await Teams.getMemberResource();
    const userTeams = _.get(user, 'metadata.teams', []);
    userTeams.push(team._id.toString());

    try {
      if (!user.ldap) {
        // Accept the team on the user object.
        await Teams.submissionModel().updateOne({
          _id: user._id,
          project: userResource.project,
          form: userResource._id,
          deleted: {$eq: null}
        }, {
          $set: {'metadata.teams': _.uniq(userTeams)}
        }).exec();
      }
    }
     catch (err) {
      debug.teamUsers(err);
    }

    try {
      // Update the accepted flag for this user.
      await Teams.submissionModel().updateOne({
        _id: member._id,
        project: memberResource.project,
        form: memberResource._id
      }, {
        $set: {'metadata.accepted': true}
      }).exec();

      // Update the member count.
      await Teams.submissionModel().updateOne({
        _id: Teams.util().idToBson(team._id)
      }, {
        $set: {'metadata.memberCount': (_.get(team, 'metadata.memberCount', 0) + 1)}
      });
    }
    catch (err) {
      debug.teamUsers(err);
      return err;
    }
    return user;
  },

  /**
   * Creates a team.
   *
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  async createTeam(req, res) {
    try {
      const teamResource = await Teams.getTeamResource();
      const team = await Teams.subRequest(req, res, 'post', teamResource, null);
      req.currentTeam = team;

      // Add the owner as a member of this team.
      req.body = {
        data: {
          email: req.user.data.email,
          admin: true,
          userId: req.user._id
        }
      };
      const member = await Teams.teamMembershipHandler('post', '')(req, res);
      await Teams.acceptTeam(req.user, member, team);
      res.status(201).send(team);
    }
    catch (err) {
      res.status(400).send(err.message);
    }
  },

  /**
   * Deletes a team.
   *
   * @param req
   * @param res
   * @return {Promise<void>}
   */
  async deleteTeam(req, res) {
    try {
      // Asynchronously remove all team members.
      await Teams.removeMembers(req.currentTeam, req, res);
      const teamResource = await Teams.getTeamResource();
      await Teams.subRequest(req, res, 'delete', teamResource, req.currentTeam._id.toString());
      res.status(200).send('OK');
    }
    catch (err) {
      res.status(400).send(err.message);
    }
  },

  /**
   * Get all of the teams a user is a part of.
   *
   * @param user - The user object.
   * @param admin - If the teams should be the ones the user is an admin of.
   * @param accepted - If the teams should be the ones the user has accepted.
   * @return {Promise<[]|*[]>}
   */
  async getTeams(user, admin, accepted) {
    const memberResource = await Teams.getMemberResource();

    // Only allow users who belong to the same project as the team member resource.
    if (!memberResource || !user.project || (user.project.toString() !== memberResource.project.toString())) {
      return [];
    }

    // Force the user ref to be the _id.
    const email = _.get(user, 'data.email', '');

    // If the user does not have an email address, then return no teams.
    if (!email) {
      debug.getTeams('User has no email address.');
      return [];
    }

    debug.getTeams(`User: ${email}, Owner: ${admin}`);

    // Build the search query for teams.
    const query = {
      project: memberResource.project,
      form: memberResource._id,
      deleted: {$eq: null},
    };

    if (admin) {
      query['data.admin'] = true;
    }

    let userData;

    try {
      // Use a case-insensitive collation query
      userData = await Teams.submissionModel().find(query).collation({locale: 'en', strength: 2}).where('data.email').equals(email);
    }
    catch (error) {
      // Fallback to regex if the collation query fails
      query['data.email'] = {
        $regex: new RegExp(_.escapeRegExp(email), 'i'),
      };

      userData = await Teams.submissionModel().find(query);
    }

    const teamsIds= userData.reduce((idList, currentItem)=>{
      if (currentItem.data && currentItem.data.team && currentItem.data.team._id) {
        idList.push(currentItem.data.team._id);
        return idList;
      }
    }, []);

    const teamsData = await Teams.submissionModel().find({
        '_id' : {$in: teamsIds},
        deleted: {$eq: null}
    });

    const membership = userData.reduce((teams, item) => {
      const id = item.data.team._id;
      const data = teamsData.find((team)=>team._id.toString() === id.toString());

      if (data) {
        item.data.team = data;
        teams.push(item);
      }
      return teams;
    }, []);

    for (const member of membership) {
      const members = await Teams.getMembers(member.data.team);
      member.data.team.metadata.memberCount = members.length;
    }

    let teams = [];

    if (user.sso && user.teams?.length) {
      const teamResource = await Teams.getTeamResource();
      teams = await Teams.submissionModel().find({
        _id: {$in: user.teams.map((id) => Teams.util().idToBson(id))},
        project: teamResource.project,
        form: teamResource._id,
        deleted: {$eq: null},
      }).lean().exec();
    }

    const userTeams = _.get(user, user.metadata ? 'metadata.teams' : 'teams', []);
    if (user.ldap) {
      user.metadata = {teams: []};
    }
    (membership || []).forEach((member) => {
      const memberTeam = _.get(member, 'data.team', null);
      if (
        memberTeam &&
        (
          (user.ldap && member.metadata && member.metadata.accepted)||
          user.sso ||
          !accepted ||
          (memberTeam._id && userTeams.indexOf(memberTeam._id.toString()) !== -1) ||
          (memberTeam.owner && user._id && (user._id.toString() === memberTeam.owner.toString()))
        )
      ) {
        teams.push(member.data.team);
        if (user.ldap) {
          user.metadata.teams.push(member.data.team._id.toString());
        }
      }
    });
    return _.uniqBy(teams, (team) => team._id.toString());
  },

  /**
   * Returns a specific team.
   *
   * @param teamId - The team Id to return.
   * @return {Promise<*>}
   */
  async getTeam(teamId) {
    if (!teamId) {
      return;
    }

    // Check teamId is a valid mongo ObjectId
    if (!Teams.util().FormioUtils.isMongoId(teamId)) {
      return;
    }

    // A team object is already provided.
    if (typeof teamId !== 'string') {
      return teamId;
    }

    const teamResource = await Teams.getTeamResource();
    return await Teams.submissionModel().findOne({
      _id: Teams.util().idToBson(teamId),
      form: teamResource._id,
      deleted: {$eq: null}
    }).lean().exec();
  },

  /**
   * Updates a team name.
   *
   * @param team
   * @param name
   */
  async updateTeam(team, name, ssoTeam = false) {
    await Teams.submissionModel().updateOne({
      _id: team._id
    }, {
      $set: {
        'data.name': name,
        'metadata.ssoteam': ssoTeam
      }
    }).exec();
    return await Teams.getTeam(team._id.toString());
  },

  /**
   * Get a team with members.
   * @param team
   */
  async addMembers(team) {
    const members = await Teams.getMembers(team);
    team.data.members = [];
    team.data.admins = [];
    (members || []).forEach((member) => {
      const teamMember = {
        _id: member.data.userId,
        memberId: member._id,
        data: {
          name: member.data.name,
          email: member.data.email
        }
      };

      teamMember.status = _.get(member, 'metadata.accepted', false)? 'accepted': 'pending';

      if (member.data.admin) {
        team.data.admins.push(teamMember);
      }
      else {
        team.data.members.push(teamMember);
      }
    });
    return team;
  },

  /**
   * Return a list of projects provided a team.
   *
   * @param team
   */
  async getTeamProjects(team) {
    const teamId = team._id.toString();
    const query = {
      $and: [
        {$or: [
            {'access.type': 'team_access'},
            {'access.type': 'team_read'},
            {'access.type': 'team_write'},
            {'access.type': 'team_admin'}
          ]},
        {
          'access.roles': {
            $in: [
              Teams.util().idToString(teamId),
              Teams.util().idToBson(teamId)
            ]
          }
        },
        {project: null}
      ],
      deleted: {$eq: null}
    };

    const projects = await Teams.projectModel().find(query).lean().exec();
    const response = [];
    _.each(projects, function(project) {
      response.push({
        _id: project._id,
        title: project.title,
        name: project.name,
        owner: project.owner,
        permission: Teams.getProjectPermission(project, teamId)
      });
    });

    debug.teamProjects(response);
    return response;
  },

  /**
   * Gets team members.
   *
   * @param team
   * @return {Promise<*>}
   */
  async getMembers(team) {
    const memberResource = await Teams.getMemberResource();
    return await Teams.submissionModel().find({
      project: memberResource.project,
      form: memberResource._id,
      deleted: {$eq: null},
      'data.team._id': Teams.util().idToBson(team._id)
    }).lean().exec();
  },

  /**
   * Get a member of a team.
   *
   * @param user
   * @param team
   */
  async getMember(user, team) {
    const memberResource = await Teams.getMemberResource();
    if (user.sso && user.teams && user.teams.indexOf(team._id.toString()) !== -1) {
      return {
        project: memberResource.project,
        form: memberResource._id,
        data: {
          email: user.data.email,
          team: team
        }
      };
    }
    return await Teams.submissionModel().findOne({
      project: memberResource.project,
      form: memberResource._id,
      deleted: {$eq: null},
      'data.team._id': team._id,
      'data.email': {
        $regex: new RegExp(user.data.email),
        $options: 'i'
      }
    }).lean().exec();
  },

  /**
   * Returns the member based on the member ID.
   * @param {*} memberId
   */
  async getMemberFromId(memberId) {
    const memberResource = await Teams.getMemberResource();
    return await Teams.submissionModel().findOne({
      project: memberResource.project,
      form: memberResource._id,
      deleted: {$eq: null},
      _id: Teams.util().idToBson(memberId)
    }).lean().exec();
  },

  /**
   * Removes all members from a team.
   *
   * @param {*} team
   */
  async removeMembers(team, req, res) {
    const members = await Teams.getMembers(team);
    (members || []).forEach(async (member) => {
      await Teams.removeTeamMembershipHandler(team, member, req, res);
    });
  },

  async currentMemberHandler(req, res, next) {
    req.currentMember = await Teams.getMember(req.user, req.currentTeam);
    next();
  },

  /**
   * Gets a user provided a team member.
   *
   * @param memberId
   */
  async getMemberUser(member) {
    const userResource = await Teams.getUserResource();
    return await Teams.submissionModel().findOne({
      project: userResource.project,
      form: userResource._id,
      deleted: {$eq: null},
      'data.email': {
        $regex: new RegExp(member.data.email),
        $options: 'i'
      }
    }).lean().exec();
  },

  /**
   * Checks to see if a user has access to a team.
   *
   * @param user
   * @param team
   * @param admin
   */
  async hasAccess(user, team, admin) {
    const member = await Teams.getMember(user, team);
    if (!member) {
      return false;
    }
    const userId = Teams.util().idToString(user._id);
    if (Teams.util().idToString(team.owner) === userId) {
      return true;
    }
    if (admin) {
      return member.data ? member.data.admin : false;
    }
    return !!member;
  },

  /**
   * Get all the teams associated with the given project.
   *
   * @param req {Object}
   *   The express request object.
   * @param project {String|Object}
   *   The project object or _id to search for the associated teams.
   * @param type {string}
   *   The project type of teams to get.
   */
  async getProjectTeams(req, projectId, type) {
    if (!projectId || projectId.hasOwnProperty('_id') && !projectId._id) {
      debug.getProjectTeams('No project given to find its teams.');
      throw new Error('No project given.');
    }

    projectId = projectId._id || projectId;
    const project = await Teams.cache().loadProject(req, projectId);
    const teamIds = [];
    const permissions = [];
    (project.access || []).forEach((access) => {
      if (access && _.startsWith(access.type, type)) {
        (access.roles || []).forEach((teamId) => {
          teamId = teamId.toString();
          teamIds.push(teamId);
          permissions[teamId] = access.type;
        });
      }
    });
    debug.getProjectTeams(permissions);
    debug.getProjectTeams(teamIds);
    const teams = await Teams.loadTeams(teamIds);
    (teams || []).forEach((team) => {
      if (team._id && permissions[team._id]) {
        team.permission = permissions[team._id];
      }
    });
    return teams;
  },

  /**
   * Converts team _ids into visible team information.
   *
   * @param teams {Object|Array}
   *   A team _id or array of team _ids to be converted into displayable information.
   *
   * @returns {Promise}
   */
  async loadTeams(teamIds) {
    const teamResource = await Teams.getTeamResource();
    teamIds = _.filter(teamIds || []);
    teamIds = _.flattenDeep(_.map(teamIds, (teamId) => [
      Teams.util().idToString(teamId),
      Teams.util().idToBson(teamId)
    ]));

    // If there are no teams, then return early.
    if (!teamIds.length) {
      return [];
    }

    debug.loadTeams(teamIds);
    return await Teams.submissionModel().find({
      form: teamResource._id,
      deleted: {$eq: null},
      _id: {$in: teamIds}
    }).lean().exec();
  },

  /**
   * Checks the access for a team.
   *
   * @param admin
   * @return {function(...[*]=)}
   */
  teamAccessHandler(admin) {
    return async function(req, res, next) {
      const team = await Teams.getTeam(req.params.teamId);

      if (!team) {
        return res.status(404).send('Could not find the team');
      }
      if (team.project.toString() !== req.user.project.toString()) {
        return res.sendStatus(401);
      }
      const access = await Teams.hasAccess(req.user, team, admin);
      if (!access) {
        return res.sendStatus(401);
      }
      req.currentTeam = team;
      next();
    };
  },

  /**
   * Removes a team from a user.
   *
   * @param team
   * @param user
   */
  async removeTeamFromUser(team, user, accepted) {
    if (!user) {
      return;
    }
    // Remove the team from the users accepted teams.
    let userTeams = _.get(user, 'metadata.teams', []);
    userTeams = _.filter(userTeams, (id) => (id !== team._id.toString()));

    // Update the user teams.
    await Teams.submissionModel().updateOne({
      _id: Teams.util().idToBson(user._id)
    }, {
      $set: {'metadata.teams': _.uniq(userTeams)}
    }).exec();

    if (!accepted) {
      return;
    }
    // Update the member count.
    return await Teams.submissionModel().updateOne({
      _id: Teams.util().idToBson(team._id)
    }, {
      $set: {'metadata.memberCount': (_.get(team, 'metadata.memberCount', 1) - 1)}
    });
  },

  /**
   * Removes a users membership from a team.
   *
   * @param team
   * @param member
   */
  async removeTeamMembership(team, member) {
    // Do not remove them from a team they do not belong to.
    if (!Teams.isMemberOfTeam(member, team)) {
      return;
    }
    const user = await Teams.getMemberUser(member);
    return await Teams.removeTeamFromUser(team, user, _.get(member, 'metadata.accepted', false));
  },

  /**
   * Express handler to remove a team from a user.
   * @param {*} team
   * @param {*} member
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  async removeTeamMembershipHandler(team, member, req, res, respond) {
    try {
      await Teams.removeTeamMembership(team, member);
      await Teams.teamMembershipHandler('delete', member._id ? member._id.toString() : '', respond)(req, res);
    }
    catch (err) {
      res.status(500).send(err.message ? err.message : err);
    }
  },

  /**
   * Create a resource sub request.
   *
   * @param req
   * @param res
   * @param method
   * @param resource
   * @param id
   */
  async subRequest(req, res, method, resource, id) {
    const subReq = Teams.util().createSubRequest(req);
    const subRes = Teams.util().createSubResponse();
    if (!subReq) {
      throw new Error('Too many recursive requests.');
    }
    subReq.method = method.toUpperCase();
    subReq.projectId = subReq.params.projectId = resource.project.toString();
    subReq.params.formId = resource._id.toString();
    subReq.permissionsChecked = true;
    subReq.noTeams = true;
    let path = '/form/:formId/submission';
    if (id) {
      subReq.subId = subReq.submissionId = subReq.params.submissionId = id;
      path += '/:submissionId';
    }
    return new Promise((resolve, reject) => {
      Teams.resourcejs()[path][method](subReq, subRes, (err) => {
        if (err) {
          return reject(err);
        }
        if (!subRes.resource || !subRes.resource.item || !subRes.resource.item._id) {
          return resolve();
        }
        return resolve(subRes.resource.item);
      });
    });
  },

  /**
  * Checks if the member is part of the team.
  * @param {*} member - the member object
  * @param {*} team - the team object
  * @returns {boolean} - true if the member is part of the team, false otherwise
  */
  isMemberOfTeam(member, team) {
    return member.data.team._id.toString() === team._id.toString();
  },

  /**
   * Handles team membership requests.
   *
   * @param req
   * @param res
   */
  teamMembershipHandler(_method = '', _memberId = '', respond) {
    return async function(req, res) {
      try {
        const method = _method || req.method.toLowerCase();
        const memberId = _memberId || req.params.submissionId;
        const memberResource = await Teams.getMemberResource();

        switch (method) {
          case 'get': {
            const member = req.currentMember || await Teams.getMemberFromId(memberId);
            if (!member || !Teams.isMemberOfTeam(member, req.currentTeam)) {
              return respond ? res.status(404).send('Team member not found') : undefined;
            }
            return respond ? res.status(200).json(member) : member;
          }
          case 'post': {
            if (req.currentTeam) {
              _.set(req.body, 'data.team', req.currentTeam);
            }
            const createdMember = await Teams.subRequest(req, res, method, memberResource, null);
            return respond ? res.status(201).json(createdMember) : createdMember;
          }
          case 'put': {
            const member = req.currentMember || await Teams.getMemberFromId(memberId);
            if (!member || !Teams.isMemberOfTeam(member, req.currentTeam)) {
              return respond ? res.status(404).send('Team member not found') : undefined;
            }
            if (req.currentTeam) {
              _.set(req.body, 'data.team', req.currentTeam);
            }
            const updatedMember = await Teams.subRequest(req, res, method, memberResource, memberId);
            return respond ? res.status(200).json(updatedMember) : updatedMember;
          }
          case 'delete': {
            const member = req.currentMember || await Teams.getMemberFromId(memberId);
            if (!member || !Teams.isMemberOfTeam(member, req.currentTeam)) {
              return respond ? res.status(404).send('Team member not found') : undefined;
            }
            await Teams.subRequest(req, res, method, memberResource, memberId);
            return respond ? res.status(200).send('OK') : undefined;
          }
          default:
            return respond ? res.status(400).send('Operation not supported') : undefined;
        }
      }
      catch (err) {
        return res.status(400).send(err.message || 'Something went wrong with your request.');
      }
    };
  },

  /**
   * Filters team membership requests.
   *
   * @param req
   * @param res
   * @param next
   */
  filterForSSOTeams: async (req, res, next) => {
    const team = await Teams.getTeam(req.params.teamId);
    if (team && team.metadata && team.metadata.ssoteam === true) {
      return res.status(403).send("Cannot perform this action on an SSO Team");
    }
    next();
  }
};

module.exports = Teams;
