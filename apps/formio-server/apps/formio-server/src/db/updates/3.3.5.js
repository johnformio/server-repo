'use strict';
const _ = require('lodash');
const async = require('async');

/**
 * Update 3.3.5
 *
 * Ensures appropriate permissions are applied to the primary project.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  const projects = db.collection('projects');
  const forms = db.collection('forms');
  const roles = db.collection('roles');
  let authRole = null;
  let adminRole = null;
  projects.findOne({
    primary: true
  }, function(err, project) {
    if (err) {
      console.log(err.message);
      return done();
    }

    // If no project exist, then just return and do not update.
    if (!project) {
      return done();
    }

    const loadRoles = function(next) {
      roles.find({
        project: project._id
      }).toArray((err, roles) => {
        if (err) {
          console.log(err.message);
          return next();
        }

        if (!roles || !roles.length) {
          return next();
        }

        roles.forEach((role) => {
          if (role.machineName === 'formio:authenticated') {
            authRole = role;
          }
          if (role.admin) {
            adminRole = role;
          }
        });

        next();
      });
    };

    const fixUserResource = function(next) {
      forms.findOne({
        project: project._id,
        name: 'user'
      }, function(err, userResource) {
        if (err) {
          console.log(err.message);
          return next();
        }

        if (!userResource) {
          return next();
        }

        console.log('Updating user resource.');
        forms.updateOne({
          _id: userResource._id
        }, {
          $set: {
            'submissionAccess': [
              {
                type: 'create_own',
                roles: []
              },
              {
                type: 'read_own',
                roles: authRole ? [authRole._id.toString()] : []
              },
              {
                type: 'update_own',
                roles: authRole ? [authRole._id.toString()] : []
              },
              {
                type: 'delete_own',
                roles: authRole ? [authRole._id.toString()] : []
              },
              {
                type: 'create_all',
                roles: adminRole ? [adminRole._id.toString()] : []
              },
              {
                type: 'read_all',
                roles: adminRole ? [adminRole._id.toString()] : []
              },
              {
                type: 'update_all',
                roles: adminRole ? [adminRole._id.toString()] : []
              },
              {
                type: 'delete_all',
                roles: adminRole ? [adminRole._id.toString()] : []
              },
              {
                type: 'self',
                roles: []
              }
            ]
          }
        }, function (err) {
          if (err) {
            console.log(err.message);
            return next();
          }

          return next();
        });
      });
    };

    const fixTeamResource = function(next) {
      forms.findOne({
        project: project._id,
        name: 'team'
      }, function(err, teamResource) {
        if (err) {
          console.log(err.message);
          return next();
        }

        if (!teamResource) {
          return next();
        }

        console.log('Updating team resource.');
        forms.updateOne({
          _id: teamResource._id
        }, {$set: {'submissionAccess': [
          {
            type: 'create_own',
            roles: authRole ? [authRole._id.toString()] : []
          },
          {
            type: 'read_own',
            roles: authRole ? [authRole._id.toString()] : []
          },
          {
            type: 'update_own',
            roles: authRole ? [authRole._id.toString()] : []
          },
          {
            type: 'delete_own',
            roles: authRole ? [authRole._id.toString()] : []
          },
          {
            type: 'create_all',
            roles: adminRole ? [adminRole._id.toString()] : []
          },
          {
            type: 'read_all',
            roles: adminRole ? [adminRole._id.toString()] : []
          },
          {
            type: 'update_all',
            roles: adminRole ? [adminRole._id.toString()] : []
          },
          {
            type: 'delete_all',
            roles: adminRole ? [adminRole._id.toString()] : []
          },
          {
            type: 'self',
            roles: []
          }
        ]}}, function(err) {
          if (err) {
            console.log(err.message);
            return next();
          }

          next();
        });
      });
    };

    async.series([
      async.apply(loadRoles),
      async.apply(fixUserResource),
      async.apply(fixTeamResource)
    ], () => done());
  });
};
