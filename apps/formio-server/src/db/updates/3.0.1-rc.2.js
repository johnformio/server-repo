'use strict';

var _ = require('lodash');
var async = require('async');
var Redis = require('redis');

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
  var _scriptFinished = false;
  var Local = Redis.createClient(config.redis.url, {max_attempts: 3});

  // Dont lock the db on errors.
  Local.on('error', function(err) {
    if(err.code === 'CONNECTION_BROKEN') {
      console.error('Redis error:');
      console.error(err);

      // Only allow the done fn to be called 1 time.
      if(!_scriptFinished) {
        _scriptFinished = true;
        return done();
      }
    }
  });

  var getOldKeys = function(next) {
    var started = false;
    var keys = {
      s: [],
      ns: []
    };

    var scan = function(cursor, type, keyFormat, cb) {
      if(cursor === '0' && started) {
        return cb();
      }

      if(!started) {
        started = true;
      }

      Local.scan(cursor, 'MATCH', keyFormat, function(err, _keys) {
        if(err) {
          return cb(err);
        }

        if(_keys) {
          if(_keys[1] &&_keys[1].length > 0) {
            keys[type] = keys[type].concat(_keys[1]);
          }

          return scan(_keys[0], type, keyFormat, cb);
        }
        else {
          return cb();
        }
      });
    };

    async.series([
      async.apply(scan, 0, 's', '10:*:s'),
      async.apply(scan, 0, 'ns', '10:*:ns'),
      async.apply(scan, 0, 's', '11:*:s'),
      async.apply(scan, 0, 'ns', '11:*:ns')
    ], function(err) {
      if(err) {
        return next(err);
      }

      next(null, keys);
    });
  };

  /**
   * Update the given value to contain a placeholder request type.
   *
   * @param {String} value
   *   The old value to manipulate.
   *
   * @returns {String}
   *   The new value to add.
   */
  var addReqTypeToOldValue = function(value) {
    var oldValue = value.split(':');
    var delta = oldValue.pop(); // Remove the very last element which should always be the delta (total req time);
    var timestamp = oldValue.pop(); // Remove the next last element which should always be the event timestamp.

    oldValue.push('unknown', timestamp, delta); // Add the request type: unknown for all old events as we cant determine what they are.
    return oldValue.join(':'); // return the new redis value, which is the old with the request type placeholder.
  };

  var storeOldDataWithNewKeys = function(key, values, _callback) {
    var keyParts = key.split(':');

    if(keyParts.length !== 3) {
      return _callback('Incorrect key type: ' + key);
    }

    var projectId = keyParts[1];
    var submissionType = keyParts[2];

    async.eachSeries(values, function(value, callback) {
      var valueParts = value.split(':');
      if(valueParts.length < 3) {
        return callback('Incorrect value type: ' + value + '\nkey: ' + key);
      }

      // Parse out the timestamp and build the new key using it.
      var curr = new Date(parseInt(valueParts[valueParts.length - 2]));
      var newKey = curr.getUTCFullYear() + ':' + curr.getUTCMonth() + ':' + curr.getUTCDate() + ':' + projectId + ':' + submissionType;

      // Update the new value to contain the request type.
      var newValue = addReqTypeToOldValue(value);

      // Store the new key and value.
      Local.rpush(newKey, newValue, function(err) {
        if(err) {
          return callback(err);
        }

        callback();
      });
    }, function(err) {
      if(err) {
        return _callback(err)
      }

      _callback();
    });
  };

  var getOldValues = function(keys, next) {
    async.each(['s', 'ns'], function(type, _callback) {
      async.each(keys[type], function(key, callback) {
        Local.lrange(key, 0, -1, function(err, values) {
          if (err) {
            return callback(err);
          }

          storeOldDataWithNewKeys(key, values, callback);
        });
      }, function(err) {
        if (err) {
          return _callback(err);
        }

        _callback();
      });
    }, function(err) {
      if(err) {
        return next(err);
      }

      next(null, keys);
    });
  };

  var markOldKeysForExpiration = function(keys, next) {
    var transaction = Local.multi();

    // For each key, check the length of the old and new key to compare.
    _.forEach(['s', 'ns'], function(type) {
      _.forEach(keys[type], function(key) {
        // Set each old key to expire in 1 day.
        transaction.expire(key, 86400)
      });
    });

    transaction.exec(function(err, response) {
      if(err) {
        return next(err);
      }

      if(!_.all(response)) {
        console.warn('A key was not able to be expired..');
      }

      next();
    });
  };

  Local.on('ready', function() {
    async.waterfall([
      getOldKeys,
      getOldValues,
      markOldKeysForExpiration
    ], function(err) {
      // Only allow the done fn to be called 1 time.
      if(!_scriptFinished) {
        if(err) {
          return done(err);
        }

        done();
      }
    });
  });
};
