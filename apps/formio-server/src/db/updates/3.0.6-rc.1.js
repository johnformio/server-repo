'use strict';

var async = require('async');
var _ = require('lodash');
var debug = {
  getAllSubmissions: require('debug')('formio:update:3.0.6-rc.1-getAllSubmissions'),
  determineDuplicates: require('debug')('formio:update:3.0.6-rc.1-determineDuplicates')
};

/**
 * Update 3.0.6-rc.1 (to be taken before 3.0.6.
 *
 * This update does the following.
 *
 *   1.) Finds all formio users with duplicate accounts.
 *   2.) Flags the least used account as deleted
 *   3.) Checks for any other duplicated usernames
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  var formCollection = db.collection('forms');
  var submissionCollection = db.collection('submissions');

  // the user resource.
  var form = '553db94e72f702e714dd9779';

  // Unique map for all submissions
  var uniques = {};
  var duplicates = {};

  async.waterfall([
    function getAllSubmissions(next) {
      submissionCollection
        .find({deleted: {$eq: null}, form: tools.util.idToBson(form)})
        .snapshot(true)
        .forEach(function(submission) {
          if (!_.has(submission, 'data.name')) {
            debug.getAllSubmissions(submission._id.toString() + ' -> No username?');
          }

          var name = _.get(submission, 'data.name');
          uniques[name] = uniques[name] || [];
          uniques[name].push(submission._id);
        }, next)
    },
    function determineDuplicates(next) {
      Object.keys(uniques).forEach(function(value) {
        if (uniques[value].length >= 2) {
          duplicates[value] = duplicates[value] || [];
          duplicates[value] = value;
          debug.determineDuplicates('Duplicate: ' + key + ', Number: ' + value.length);
        }
      });

      return next();
    },
    function checkForDuplicateSubmission(next) {
      
    }
  ], function(err) {
    if (err) {
      return done(err);
    }

    return done();
  });
};
