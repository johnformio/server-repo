'use strict';

/**
 * Update 3.0.1-rc.2
 *
 * This is a private update script to be taken before 3.0.1.
 *
 * Updates all the redis keys for analytics from:
 * month:projectId:s and month:projectId:ns
 * to
 * year:month:day:projectId:s and year:month:day:projectId:ns
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  // This update hook has been deprecated since redis analytics has been removed.
  return done();
};
