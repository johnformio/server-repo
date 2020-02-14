'use strict';
const _ = require('lodash');
const async = require('async');

/**
 * Update 3.3.4
 *
 * Update all tenant projects to have the same project plan as their parent project.
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

        if (!project) {
          return next();
        }

        projects.updateOne({
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
