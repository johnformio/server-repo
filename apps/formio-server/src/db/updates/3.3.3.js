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
  done();
  console.log('Updating project types.');
  db.collection('projects').updateMany({project: {$ne: null}}, {$set: {type: 'stage'}});
  db.collection('projects').updateMany({project: null}, {$set: {type: 'project'}});
};
