'use strict';
const _ = require('lodash');
const async = require('async');

/**
 * Update 3.3.2
 *
 * Adds the project ID to all submissions.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  // Return immediately so it will not wait to update all submissions.
  done();
  let count = 0;
  console.log('Updating form submissions to add project IDs.');
  const submissionsCollection = db.collection('submissions');
  const formsCollection = db.collection('forms');
  const formsCursor = formsCollection.find({});
  const getNext = function(cursor, next) {
    cursor.hasNext().then((hasNext) => {
      if (hasNext) {
        count++;
        return cursor.next().then(next);
      }
      else {
        return next();
      }
    });
  };
  let hasNext = true;
  async.doWhilst((next) => {
    getNext(formsCursor, (form) => {
      if (!form) {
        hasNext = false;
        return next();
      }

      submissionsCollection.updateMany({
        form: form._id
      }, {
        $set: {project: form.project}
      }, (err) => {
        if (err) {
          return next(err);
        }
        if ((count % 1000) === 0) {
          process.stdout.write('.');
        }
        if ((count % 50000) === 0) {
          process.stdout.write("\n");
        }
        return next();
      });
    });
  }, (next) => {
    return next(null, hasNext);
  }, (err) => {
    if (err) {
      return console.log(err);
    }
    return console.log('DONE!');
  });
};
