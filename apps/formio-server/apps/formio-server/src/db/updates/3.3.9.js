'use strict';
const _ = require('lodash');
const async = require('async');

/**
 * Update 3.3.7
 *
 * Adds 30 day expirations to actionitems.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  done();
  console.log('Adding 30d expiration to actionitems.');
  db.collection('actionitems').dropIndex({created: 1}).then(() => {
    try {
      db.collection('actionitems').createIndex({created: 1}, {
        background: true,
        expireAfterSeconds: 2592000
      });
    }
    catch (err) {
      console.log(err.message);
    }
  });
};
