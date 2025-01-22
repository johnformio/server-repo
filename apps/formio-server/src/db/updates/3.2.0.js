'use strict';

const async = require('async');
const _ = require('lodash');
const mongodb = require('mongodb');

/**
 * Update 3.2.0
 *
 * This update fixes an issue where on premise stages were set to trial which would cause lots of things to fail when
 * the trial expired. They should have been set to commercial in the first place. This will update all projects to
 * commercial
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  // Do not run on hosted platform
  if (config.licenseRemote) {
    return done();
  }

  db.collection('projects').updateMany({}, {$set: {plan: 'commercial'}}).then(() => {
    console.log('Done updating all projects to Enterprise');
    done();
  }).catch((err) => {
    console.log(err.message);
    done();
  });
};
