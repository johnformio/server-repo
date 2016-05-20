'use strict';

var async = require('async');
var util = require('../../util/util');
var _ = require('lodash');

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
  var roleCollection = db.collection('roles');
  var projectCollection = db.collection('projects');

  var getProjectName = function(next) {
    projectCollection.findOne({deleted: {$eq: false}}, function(err, project) {
      if (err) {
        return next(err);
      }

      return next(null, project.name || '');
    })
  }

  async.waterfall([
    // Get all projects in the system.
    function getAllProjects(callback) {
      projectCollection.find({deleted: {$eq: null}}).snapshot(true).toArray(function(err, projects) {
        if (err) {
          return callback(err);
        }

        var projectIds = _.pluck(projects, '_id');
        callback(err, projectIds);
      });
    },

    // Fix the default roles
    function getAllDefaultRoles(projectIds, callback) {
      roleCollection.find({deleted: {$eq: null}, default: true}).snapshot(true).toArray(function(err, roles) {
        if (err) {
          return callback(err);
        }

        var roleIds = _.pluck(roles, 'project');
        callback(null, projectIds, roleIds);
      });
    },
    function createMissingDefaultRoles(projectIds, roleIds, callback) {
      var todo = _.difference(projectIds, roleIds);

      // For each missing role, construct the correct role.
      async.each(todo, function(project, next) {

        // get each projects name for the role machine name.
        getProjectName(function(err, name) {
          if (err) {
            return next(err);
          }

          roleCollection.insertOne({
            project: project,
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
        };

        callback(null, projectIds);
      });
    },

    // Fix the admin roles.
    function getAllAdminRoles(projectIds, callback) {
      roleCollection.find({deleted: {$eq: null}, admin: true}).snapshot(true).toArray(function(err, roles) {
        if (err) {
          return callback(err);
        }

        var roleIds = _.pluck(roles, 'project');
        callback(null, projectIds, roleIds);
      });
    },
    function createMissingAdminRoles(projectIds, roleIds, callback) {
      var todo = _.difference(projectIds, roleIds);

      // For each missing role, construct the correct role.
      async.each(todo, function(project, next) {

        // get each projects name for the role machine name.
        getProjectName(function(err, name) {
          if (err) {
            return next(err);
          }

          roleCollection.insertOne({
            project: project,
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
        };

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
