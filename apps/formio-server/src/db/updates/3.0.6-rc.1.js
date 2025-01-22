'use strict';

let async = require('async');
let _ = require('lodash');
let debug = {
  uniquifyName: require('debug')('formio:update:3.0.6-rc.1-uniquifyName'),
  updateSubmissionNames: require('debug')('formio:update:3.0.6-rc.1-updateSubmissionNames'),
  getAllSubmissions: require('debug')('formio:update:3.0.6-rc.1-getAllSubmissions'),
  determineDuplicates: require('debug')('formio:update:3.0.6-rc.1-determineDuplicates'),
  filterDuplicates: require('debug')('formio:update:3.0.6-rc.1-filterDuplicates'),
  uniquifyDupUsers: require('debug')('formio:update:3.0.6-rc.1-uniquifyDupUsers'),
  uniquifyDupNames: require('debug')('formio:update:3.0.6-rc.1-uniquifyDupNames')
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
  let projectCollection = db.collection('projects');
  let submissionCollection = db.collection('submissions');

  // the user resource.
  let form = '553db94e72f702e714dd9779';

  // Unique map for all submissions
  let uniques = {};
  let duplicates = {};

  /**
   * Attempt to update the given submissions username to be unique, limited to 10 iterations.
   *
   * @param submission
   * @param next
   */
  let uniquifyName = function(submission, next) {
    let tries = 2;
    let found = false;

    async.whilst(function(next) {
      return next(null, (tries < 12) && (found === false));
    }, function(callback) {
      // check for unique name
      submissionCollection
      .find({deleted: {$eq: null}, 'data.name': (submission.data.name + tries.toString()), form: tools.util.idToBson(form)})
      .countDocuments(function(err, count) {
        if (err) {
          return callback(err);
        }

        // unique was found
        if (count === 0) {
          found = true;
        }

        callback();
      });
    }, function(err) {
      if (err) {
        return next(err);
      }
      if (found === false) {
        debug.uniquifyName(submission.data.name + ' -> Fail.., tries: ' + tries);
        return next('Couldnt find a unique name for: ' + submission._id);
      }

      debug.uniquifyName(submission.data.name + ' -> ' + (submission.data.name + tries.toString()));
      submissionCollection
      .updateOne({_id: tools.util.idToBson(submission._id)}, {$set: {'data.name': (submission.data.name + tries.toString())}}, function(err, result) {
        if (err) {
          return next(err);
        }

        return next();
      });
    });
  };

  /**
   * Give every given submission a unique username.
   *
   * @param submissions
   * @param next
   */
  let updateSubmissionNames = function(submissions, next) {
    debug.updateSubmissionNames(submissions.length);
    async.each(submissions, function(submission, cb) {
      return uniquifyName(submission, cb);
    }, function(err) {
      if (err) {
        return next(err);
      }

      return next();
    });
  };

  async.waterfall([
    // get all formio users
    function getAllSubmissions(next) {
      submissionCollection
      .find({deleted: {$eq: null}, form: tools.util.idToBson(form)})
      .snapshot(true)
      .forEach(function(submission) {
        if (!_.has(submission, 'data.name')) {
          debug.getAllSubmissions(submission._id.toString() + ' -> No username?');
        }

        // determine which names are unique
        let name = _.get(submission, 'data.name');
        uniques[name] = uniques[name] || [];
        uniques[name].push(submission._id);
      }, next)
    },
    // check the unique names list for duplicates
    function determineDuplicates(next) {
      Object.keys(uniques).forEach(function(value) {
        if (uniques[value].length >= 2) {
          duplicates[value] = uniques[value];
          debug.determineDuplicates('Duplicate: ' + value + ', Number: ' + uniques[value].length);
        }
      });

      return next();
    },
    // filter the known duplicates, to determine if they are duplicate users, or individual users with duplicate names
    function filterDuplicates(next) {
      let dupUser = []; // [[id, id], [id, id]] - array of duplicate users arrays
      let dupName = {}; // name:[id] map

      debug.filterDuplicates(duplicates);
      async.each(Object.keys(duplicates), function(value, cb) {
        debug.filterDuplicates(value);

        // get the duplicate subs for comparison
        submissionCollection
        .find({_id: {$in: duplicates[value]}, deleted: {$eq: null}}, {_id: 1, 'data.name': 1, 'data.email': 1})
        .snapshot(true)
        .toArray(function(err, subs) {
          if (err) {
            return cb(err);
          }

          let sameUser = {}; // email:[_id] map
          let idToName = {}; // _id:name map

          subs.forEach(function(user) {
            let email = user.data.email.toString().toLowerCase();
            let name = user.data.name.toString().toLowerCase();

            sameUser[email] = sameUser[email] || [];
            sameUser[email].push(user._id);

            idToName[user._id] = name;
          });

          Object.keys(sameUser).forEach(function(email) {
            if (sameUser[email].length >= 2) {
              // user name and email was duplicated, same user
              debug.filterDuplicates('duplicate/same users: ' + sameUser[email]);
              dupUser.push(sameUser[email]);
            }
            else if (sameUser[email].length === 1) {
              // name and email was no duplicated, different users
              let id = sameUser[email][0];
              dupName[idToName[id]] = dupName[idToName[id]] || [];

              debug.filterDuplicates('duplicate/different users (' + idToName[id] + '): ' + id);
              dupName[idToName[id]].push(tools.util.idToBson(id));
            }
          });

          cb();
        });
      }, function(err) {
        if (err) {
          return next(err);
        }

        return next(null, dupUser, dupName);
      });
    },
    // fix duplicate user accounts by flagging the least used as deleted
    function uniquifyDupUsers(dupUsers, dupNames, next) {
      async.each(dupUsers, function(users, cb) {
        let most = {
          id: null,
          count: null
        };

        debug.uniquifyDupUsers(users.length);
        async.each(users, function(id, callback) {
          projectCollection.find({owner: tools.util.idToBson(id)}).countDocuments(function(err, count) {
            if (err) {
              return cb(err);
            }

            debug.uniquifyDupUsers('user: ' + id + ', projects: ' + count);
            if (most.id === null && most.count === null) {
              most.id = id;
              most.count = count;
            }
            else if (most.count < count) {
              most.id = id;
              most.count = count;
            }

            callback();
          });
        }, function(err) {
          if (err) {
            return cb(err);
          }

          // Make the user defined in most, be the primary account holder.
          let flagAsDeleted = [];
          users.forEach(function(u) {
            if (tools.util.idToString(u) !== tools.util.idToString(most.id)) {
              flagAsDeleted.push(tools.util.idToBson(u));
            }
          });

          submissionCollection.updateOne({
            _id: {$in: flagAsDeleted},
            deleted: {$eq: null},
            form: tools.util.idToBson(form)
          }, {
            $set: {deleted: Date.now()}
          }, function(err, res) {
            if (err) {
              return cb(err);
            }

            return cb();
          });
        });
      }, function(err) {
        if (err) {
          return next(err);
        }

        return next(null, dupNames);
      });
    },
    // fix duplicate user names by granting the original name to the oldest account and iterating the name for the newest.
    function uniquifyDupNames(dupNames, next) {
      async.each(Object.keys(dupNames), function(name, cb) {
        let ids = dupNames[name];

        debug.uniquifyDupNames('name: ' + name + ', dups: ' + ids.length);
        submissionCollection
        .find({deleted: {$eq: null}, form: tools.util.idToBson(form), _id: {$in: ids}})
        .sort({created: 1})
        .skip(1) // leave the oldest unchanged
        .toArray(function(err, submissions) {
          if (err) {
            return cb(err);
          }

          return updateSubmissionNames(submissions, cb)
        });
      }, function(err) {
        if (err) {
          return next(err);
        }

        return next();
      });
    }
  ], function(err) {
    if (err) {
      return done(err);
    }

    return done();
  });
};
