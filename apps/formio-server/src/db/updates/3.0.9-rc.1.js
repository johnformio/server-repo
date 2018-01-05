'use strict';

let debug = {
  updateProjects: require('debug')('formio:update:3.0.9-rc.1-updateProjects')
};

/**
 * Update 3.0.9-rc.1 (to be taken before 3.0.7)
 *
 * This update does the following.
 *
 *   1.) Finds all formio projects which dont have a valid project plan
 *   2.) Set invalid project plans to basic
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  let projectCollection = db.collection('projects');
  let valid = ['basic', 'independent', 'team', 'commercial'];

  // fix broken projects
  projectCollection
  .update(
    {
      deleted: {$eq: null},
      plan: {$nin: valid}
    },
    {
      $set: {
        plan: 'basic'
      }
    },
    {
      upsert: false,
      multi: true
    },
    function(err, results) {
      if (err) {
        debug.updateProjects(err);
        return done(err);
      }

      debug.updateProjects(results);
      return done();
    }
  );
};
