'use strict';
const Redis = require('redis');
const debug = require('debug')('formio:redis');

class RedisInterface {
  constructor(config) {
    this.db = null;
    this.config = config;
    this.connect();
  }

  getDb(cb) {
    if (this.db) {
      return cb(null, this.db);
    }
    else {
      return cb(new Error('Redis not found.'), null);
    }
  }

  middleware(req, res, next) {
    this.get((err, db) => {
      if (err) {
        return res.status(500).send(err.message);
      }
      req.redis = res.redis = db;
      next();
    });
  }

  connect() {
    // Redis is not currently connected, attempt to configure the connection.
    if (this.config.redis && this.config.redis.url) {
      var opts = {
        'retry_strategy': (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            // End reconnecting on a specific error and flush all commands with
            // a individual error
            this.db = null;
            return new Error('The server refused the connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands
            // with a individual error
            this.db = null;
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            // End reconnecting with built in error
            this.db = null;
            return undefined;
          }
          // reconnect after
          return Math.min(options.attempt * 100, 3000);
        }
      };
      if (this.config.redis.password) {
        /* eslint-disable */
        opts.auth_pass = this.config.redis.password;
        /* eslint-enable */
      }

      // Attempt to connect to redis.
      this.db = Redis.createClient(this.config.redis.url, opts);

      // Attach debugging to specific events, unset redis ref on error/disconnect.
      this.db.on('ready', () => {
        debug('Connected');
      });
      this.db.on('end', () => {
        this.db = null;
        debug('End');
      });
    }
    else {
      this.db = null;
      debug('Redis options not found or incomplete: ' + JSON.stringify(this.config.redis || {}));
    }
  }
}

module.exports = RedisInterface;
