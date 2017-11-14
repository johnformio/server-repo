'use strict';

/**
 * Run all updates sequentially to ensure they are good to go.
 */
module.exports = function(db, config, tools, done) {
  // Ensure we always run rc2 again.
  let rc2 = require('./3.1.0-rc.2');
  let core309 = require('formio/src/db/updates/3.0.9');
  rc2(db, config, tools, () => {
    core309(db, config, tools, () => {
      console.log('Dropping projects index machineName_1');
      db.collection('projects').dropIndex('machineName_1').then(() => {
        console.log('Done dropping projects index machineName_1');
        done();
      }).catch((err) => {
        console.log(err.message);
        done();
      });
    });
  });
};
