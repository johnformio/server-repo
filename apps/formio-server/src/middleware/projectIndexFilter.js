'use strict';

const _ = require('lodash');

/**
 * Middleware to filter the project index request by owner and team access.
 *
 * @param formioServer
 * @returns {Function}
 */
module.exports = function(formioServer) {
  return function projectIndexFilter(req, res, next) {
    let query;

    // Allow access to all projects for admins, otherwise restrict to user.
    if (!req.isAdmin) {
      if (!req.user || !req.user._id || !req.user.teams) {
        return res.sendStatus(401);
      }
      const roles = _.filter(_.flattenDeep(_.map(req.user.teams, function(role) {
        const bson = formioServer.formio.util.idToBson(role);
        if (!bson) {
          return false;
        }
        return [formioServer.formio.util.idToString(role), bson];
      })));
      query = {
        $or: [
          // If owner.
          {
            owner: formioServer.formio.util.ObjectId(req.token.user._id)
          },
          // If has team permission.
          {
            access: {
              $elemMatch: {
                'type': {$in: ['team_read', 'team_write', 'team_admin']},
                'roles': {$in: roles}
              }
            }
          },
          // If primary with team access.
          {
            access: {
              $elemMatch: {
                'type': {$in: ['team_access']},
                'roles': {$in: roles}
              }
            },
            project: {$exists: false}
          },
          // If is a stage and has stage permission.
          {
            $and: [
              {
                project: {$exists: true},
                access: {
                  $elemMatch: {
                    'type': 'team_access',
                    'roles': {$in: roles}
                  }
                }
              },
              {
                project: {$exists: true},
                access: {
                  $elemMatch: {
                    'type': {$in: ['stage_read', 'stage_write']},
                    'roles': {$in: roles}
                  }
                }
              }
            ]
          },
          {
            name: {$in: _.keys(req.access)}
          },
          {
            name: {$in: _.keys(req.user.access)}
          }
        ]
      };
    }

    req.modelQuery = req.modelQuery || req.model || this.model;
    req.modelQuery = req.modelQuery.find(query);
    next();
  };
};
