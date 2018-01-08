'use strict';

const Q = require('q');
const async = require('async');

/**
 * Keep track of spark mappings across multiple servers.
 */
class SparkCollection {
  constructor() {
    this.sparks = {};
    this.ready = false;
    this.redis = null;
  }

  /**
   * Connect to the Spark collection.
   *
   * @param redis
   * @returns {*|promise}
   */
  connect(redis) {
    const deferred = Q.defer();
    redis.getDb((err, db) => {
      if (err) {
        return deferred.reject(err.message);
      }
      if (!db) {
        return deferred.reject('Could not create Redis database');
      }
      this.redis = db;
      if (this.redis) {
        this.redis.on('error', function() {
          this.ready = false;
          this.redis = null;
          deferred.reject();
        }.bind(this));
        this.redis.on('ready', function() {
          this.ready = true;
          deferred.resolve();
        }.bind(this));
        this.redis.on('end', function() {
          this.ready = false;
          this.redis = null;
          deferred.reject();
        }.bind(this));
      }
      else {
        this.redis = null;
        this.ready = true;
        deferred.resolve();
      }
    });
    return deferred.promise;
  }

  /**
   * Get a spark provided the spark key.
   *
   * @param key
   * @returns {*}
   */
  get(key) {
    const deferred = Q.defer();
    if (this.redis) {
      const promise = Q.ninvoke(this.redis, 'get', `spark:${key}`);
      if (promise) {
        return promise;
      }
      else {
        deferred.reject('Could not find spark.');
      }
    }
    else if (this.sparks.hasOwnProperty(key)) {
      deferred.resolve(this.sparks[key]);
    }
    else {
      deferred.reject('No spark found.');
    }
    return deferred.promise;
  }

  /**
   * Set the spark object.
   *
   * @param key
   * @param obj
   * @returns {*}
   */
  set(key, obj) {
    if (this.redis) {
      return Q.ninvoke(this.redis, 'set', `spark:${key}`, obj);
    }
    else {
      const deferred = Q.defer();
      this.sparks[key] = obj;
      deferred.resolve();
      return deferred.promise;
    }
  }

  /**
   * Clear the spark collection.
   *
   * @returns {*|promise}
   */
  clear() {
    const deferred = Q.defer();
    if (this.redis) {
      this.redis.keys('spark:*', function(err, keys) {
        if (err) {
          return deferred.reject(err);
        }

        async.eachSeries(keys, this.redis.del.bind(this.redis), function() {
          deferred.resolve();
        });
      }.bind(this));
    }
    else {
      this.sparks = {};
      deferred.resolve();
    }
    return deferred.promise;
  }

  /**
   * Delete a spark item.
   *
   * @param key
   * @returns {*}
   */
  del(key) {
    if (this.redis) {
      return Q.ninvoke(this.redis, 'del', `spark:${key}`);
    }
    else if (this.sparks.hasOwnProperty(key)) {
      const deferred = Q.defer();
      delete this.sparks[key];
      deferred.resolve();
      return deferred.promise;
    }
  }
}

module.exports = SparkCollection;
