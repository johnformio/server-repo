'use strict';

let async = require('async');
let _ = require('lodash');

/**
 * Update 3.0.4
 *
 * This update does the following.
 *
 *   1.) Finds all projects without a default role, and re-adds it.
 *   2.) Finds all projects without a admin role, and re-adds it.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  let roleCollection = db.collection('roles');
  let projectCollection = db.collection('projects');

  let getProjectName = function(id, next) {
    projectCollection.findOne({deleted: {$eq: null}, _id: tools.util.idToBson(id)}, function(err, project) {
      if (err) {
        return next(err);
      }
      if (!project) {
        return next('No project found w/ _id: ' + tools.util.idToString(id));
      }

      return next(null, project.name);
    });
  };

  async.waterfall([
    // Get all projects in the system.
    function getAllProjects(callback) {
      projectCollection.find({deleted: {$eq: null}}).snapshot(true).toArray(function(err, projects) {
        if (err) {
          return callback(err);
        }

        let projectIds = _.pluck(projects, '_id');
        projectIds = _.map(projectIds, tools.util.idToString);
        callback(err, projectIds);
      });
    },

    // Fix the default roles
    function getAllDefaultRoles(projectIds, callback) {
      roleCollection.find({deleted: {$eq: null}, default: true}).snapshot(true).toArray(function(err, roles) {
        if (err) {
          return callback(err);
        }

        let roleIds = _.pluck(roles, 'project');
        roleIds = _.map(roleIds, tools.util.idToString);
        callback(null, projectIds, roleIds);
      });
    },
    function createMissingDefaultRoles(projectIds, roleIds, callback) {
      let todo = _.difference(projectIds, roleIds);

      // For each missing role, construct the correct role.
      async.each(todo, function(project, next) {

        // get each projects name for the role machine name.
        getProjectName(project, function(err, name) {
          if (err) {
            return next(err);
          }

          roleCollection.insertOne({
            project: tools.util.idToBson(project),
            title: 'Default',
            description: 'The Default Role.',
            deleted: null,
            admin: false,
            default: true,
            machineName: name + ':default'
          }, function(err) {
            if (err) {
              return next(err);
            }

            next();
          });
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }

        callback(null, projectIds);
      });
    },

    // Fix the admin roles.
    function getAllAdminRoles(projectIds, callback) {
      roleCollection.find({deleted: {$eq: null}, admin: true}).snapshot(true).toArray(function(err, roles) {
        if (err) {
          return callback(err);
        }

        let roleIds = _.pluck(roles, 'project');
        roleIds = _.map(roleIds, tools.util.idToString);
        callback(null, projectIds, roleIds);
      });
    },
    function createMissingAdminRoles(projectIds, roleIds, callback) {
      let todo = _.difference(projectIds, roleIds);

      // For each missing role, construct the correct role.
      async.each(todo, function(project, next) {

        // get each projects name for the role machine name.
        getProjectName(project, function(err, name) {
          if (err) {
            return next(err);
          }

          roleCollection.insertOne({
            project: tools.util.idToBson(project),
            title: 'Administrator',
            description: 'The Administrator Role.',
            deleted: null,
            admin: true,
            default: false,
            machineName: name + ':administrator'
          }, function(err) {
            if (err) {
              return next(err);
            }

            next();
          });
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }

        callback();
      });
    }
  ], function(err) {
    if (err) {
      return done(err);
    }

    done();
  });
};
