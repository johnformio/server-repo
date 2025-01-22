'use strict';

const async = require('async');
const _ = require('lodash');
const mongodb = require('mongodb');

/**
 * Update 3.1.0-rc.2
 *
 * This update does the following.
 *
 *   1.) Deletes all existing machineName indexes.
 *   2.) Creates new indexes with the appropriate db settings.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  let fixDuplicates = function(collection, next) {
    console.log('Fetching duplicate machineNames for ' + collection);
    db.collection(collection).aggregate([
      {
        $match: {deleted: null}
      },
      { $group: {
        _id: { machineName: "$machineName" },
        ids: { $addToSet: "$_id" },
        count: { $sum: 1 }
      } },
      { $match: {
        count: { $gte: 2 }
      } }
    ]).exec(function(err, results) {
      if (err) {
        return next(err);
      }

      async.eachSeries(results, (result, resultDone) => {
        let i = 0;
        async.eachSeries(result.ids, (id, idDone) => {
          if ((i++ > 0) || !result._id.machineName) {
            console.log('Updating machineName ' + result._id.machineName + ': Instance ' + i + ' (' + id + ')');

            if (!result._id.machineName) {
              result._id.machineName = 'entity';
            }

            db.collection(collection).updateOne({
              _id: mongodb.ObjectID(id)
            }, {
              '$set': {
                machineName: result._id.machineName + i
              }
            }, idDone)
          }
          else {
            idDone();
          }
        }, resultDone);
      }, next);
    });
  };

  async.series([
    async.apply(fixDuplicates, 'roles'),
    async.apply(fixDuplicates, 'forms'),
    async.apply(fixDuplicates, 'actions'),
    async.apply(fixDuplicates, 'projects')
  ], () => {
    // Run again to make sure they are all taken care of.
    async.series([
      async.apply(fixDuplicates, 'roles'),
      async.apply(fixDuplicates, 'forms'),
      async.apply(fixDuplicates, 'actions'),
      async.apply(fixDuplicates, 'projects')
    ], () => {
      done();
    });
  });
};
