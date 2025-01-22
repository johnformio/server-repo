'use strict';
const _ = require('lodash');
const async = require('async');

/**
 * Update 3.3.1
 *
 * Fixes all project access to remove any duplicates.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  const projectsCollection = db.collection('projects');
  projectsCollection.find({}, {$snapshot: true}).toArray(function(err, projects) {
    if (err) {
      return next(err);
    }

    async.each(projects, function(project, next) {
      const count = project.access.length;
      project.access = _.uniqBy(project.access, 'type');
      if (project.access.length !== count) {
        console.log('Removing ' + (count - project.access.length) + ' access duplicates for ' + project._id);
        projectsCollection.updateOne({_id: project._id}, {$set: {"access": project.access}}, (err) => {
          if (err) {
            return next(err);
          }
          next();
        });
      }
      else {
        next();
      }
    }, function(err) {
      if (err) {
        return done(err);
      }

      done();
    });
  });
};
