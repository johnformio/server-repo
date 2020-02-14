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
  projects.findOne({
    primary: true
  }, function(err, project) {
    if (err) {
      console.log(err.message);
      return;
    }

    const roles = db.collection('roles');
    roles.find({
      project: project._id
    }).toArray((err, roles) => {
      if (err) {
        console.log(err.message);
        return;
      }

      let authRole = null;
      let adminRole = null;
      roles.forEach((role) => {
        if (role.machineName === 'formio:authenticated') {
          authRole = role;
        }
        if (role.admin) {
          adminRole = role;
        }
      });

      const forms = db.collection('forms');
      forms.findOne({
        project: project._id,
        name: 'user'
      }, function(err, userResource) {
        if (err) {
          console.log(err.message);
          return;
        }

        console.log('Updating user resource.');
        forms.updateOne({
          _id: userResource._id
        }, {$set: {'submissionAccess': [
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
        ]}}, function(err) {
          if (err) {
            console.log(err.message);
            return;
          }

          forms.findOne({
            project: project._id,
            name: 'team'
          }, function(err, teamResource) {
            if (err) {
              console.log(err.message);
              return;
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
                roles: []
              },
              {
                type: 'update_own',
                roles: []
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
                return;
              }

              done();
            });
          });
        });
      });
    });
  });
};
