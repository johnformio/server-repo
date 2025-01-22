'use strict';

/**
 * Update 3.3.0
 *
 * Re-execute 3.2.0 with correct spelling.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  require('./3.2.0')(db, config, tools, done);
};
