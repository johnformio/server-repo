'use strict';
const _ = require('lodash');
const async = require('async');

/**
 * Update 3.3.3
 *
 * Update all projects with "project" set to be of type "stage"
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  console.log('Updating tenant project plans.');
  const projects = db.collection('projects');
  projects.find({
    type: 'tenant',
    deleted: {$eq: null}
  }, {$snapshot: true}).toArray(function(err, tenants) {
    if (err) {
      return done(err);
    }

    async.eachSeries(tenants, function(tenant, next) {
      projects.findOne({
        _id: tenant.project,
        deleted: {$eq: null}
      }, function(err, project) {
        if(err) {
          return next(err);
        }

        projects.update({
          _id: tenant._id
        }, {
          $set: {'plan': project.plan}
        }, function(err) {
          if (err) {
            return next(err);
          }

          return next();
        });
      });
    }, function(err) {
      if (err) {
        return done(err);
      }

      done();
    });
  });
};
