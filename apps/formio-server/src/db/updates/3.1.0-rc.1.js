'use strict';

let debug = {
  updateProjects: require('debug')('formio:update:3.1.0-rc.1-updateProjects')
};

/**
 * Update 3.1.0-rc.1
 *
 * This update does the following.
 *
 *   1.) Finds all formio projects which are set to basic trials
 *   2.) Upgrade all basic plans to trials
 *   3.) Set the trial date to now.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  done();
  //let projectCollection = db.collection('projects');
  //
  //// fix broken projects
  //projectCollection
  //  .update(
  //    {
  //      deleted: {$eq: null},
  //      plan: 'basic'
  //    },
  //    {
  //      $set: {
  //        plan: 'trial',
  //        trial: (new Date()).toISOString().replace('T', ' ')
  //      }
  //    },
  //    {
  //      upsert: false,
  //      multi: true
  //    },
  //    function(err, results) {
  //      if (err) {
  //        debug.updateProjects(err);
  //        return done(err);
  //      }
  //
  //      debug.updateProjects(results);
  //      return done();
  //    }
  //  );
};
