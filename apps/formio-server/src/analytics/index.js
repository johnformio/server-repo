'use strict';

var Redis = require('redis');
var onFinished = require('on-finished');
var debug = {
  connect: require('debug')('formio:analytics:connect'),
  record: require('debug')('formio:analytics:record'),
  hook: require('debug')('formio:analytics:hook'),
  getCalls: require('debug')('formio:analytics:getCalls'),

  createAnalyticsHash: require('debug')('formio:analytics:createAnalyticsHash'),
  getAnalyticsHashByKey: require('debug')('formio:analytics:getAnalyticsHashByKey'),
  getDisplayAnalytics: require('debug')('formio:analytics:getDisplayAnalytics')
};
var url = require('url');
var submission = /(\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission)/i;

/**
 *
 * @param config
 * @returns {{record: Function}}
 */
module.exports = function(config) {
  var redis = null;

  /**
   * Get the redis connection.
   *
   * @returns {*}
   */
  var getRedis = function() {
    return redis;
  };

  /**
   * Configure the redis connection.
   *
   * @returns {boolean}
   *   If the server is connected or not.
   */
  var connect = function() {
    // Only connect once.
    if (redis && redis.hasOwnProperty('connected') && redis.connected === true) {
      debug.connect('Already connected.');
      return true;
    }
    // Redis is not currently connected, attempt to configure the connection.
    else if (config.redis && config.redis.port && config.redis.address) {
      var opts = {};
      if (config.redis.password) {
        opts.auth_pass = config.redis.password;
      }

      // Attempt to connect to redis 1 time only.
      redis = Redis.createClient(config.redis.port, config.redis.address, opts);
      redis.max_attempts = 1;

      // Attach debugging to specific events, unset redis ref on error/disconnect.
      redis.on('ready', function() {
        debug.connect('Connected');
      });
      redis.on('error', function(err) {
        redis = null;
        debug.connect(err.message || err);
      });
      redis.on('end', function() {
        redis = null;
        debug.connect('End');
      });
    }
    else {
      debug.connect('Redis options not found or incomplete: ' + JSON.stringify(config.redis || {}));
      return false;
    }
  };

  /**
   * Express middleware for tracking request analytics.
   *
   * @param project {String}
   *   The Project Id of this request.
   * @param path {String}
   *   The requested url for this request.
   * @param start {Number}
   *   The date timestamp this request started.
   */
  var record = function(project, path, start) {
    if (!connect()) {
      debug.record('Skipping, redis not found.');
      return;
    }
    if (!project) {
      debug.record('Skipping non-project request: ' + path);
      return;
    }
    if (!path) {
      debug.record('Skipping request, unknown path: ' + path);
      return;
    }

    // Update the redis key, dependent on if this is a submission or non-submission request.
    var now = new Date();
    var key = now.getUTCFullYear() + ':' + now.getUTCMonth() + ':' + now.getUTCDate() + ':' + project;
    if (!submission.test(path)) {
      debug.record('Updating key, non-submission request: ' + path);
      key += ':ns';
    }
    else {
      key += ':s';
    }

    debug.record('Start: ' + start);
    debug.record('dt: ' + (now.getTime() - Number.parseInt(start, 10)).toString());
    var delta = start
      ? now.getTime() - start
      : 0;
    var value = path + ':' + now.getTime() + ':' + delta;

    redis.rpush(key, value, function(err, length) {
      if (err) {
        debug.record(err);
        return;
      }

      debug.record(key + ' => ' + value + ' => ' + length);
    });
  };

  /**
   * Hook the response and record the event in redis, after the response is sent.
   *
   * @param req
   * @param res
   * @param next
   */
  var hook = function(req, res, next) {
    if (!connect()) {
      return next();
    }

    // Attach the request start time.
    req._start = (new Date()).getTime();
    debug.hook(req._start);

    onFinished(res, function(err) {
      if (err) {
        debug.hook(err);
        return;
      }
      if (!req.projectId) {
        debug.hook('No projectId found in the request, skipping redis record.');
        return;
      }

      var id = req.projectId;
      var path = url.parse(req.url).pathname;
      var start = req._start;
      record(id, path, start);
    });

    next();
  };

  /**
   * Get the number of calls made for the given month and project.
   *
   * @param month {number|string}
   *   The month number to search for (0-11).
   * @param project {string}
   *   The Project Id to search for.
   * @param next {function}
   */
  var getCalls = function(year, month, day, project, next) {
    if (!connect() || !year || !month || !project) {
      debug.getCalls('Skipping');
      return next();
    }

    if (!day) {
      day = '*';
    }

    // Only look for submission calls.
    var key = year.toString() + ':' + month.toString() + ':' + day.toString() + ':' + project.toString() + ':s';
    redis.llen(key, function(err, value) {
      if (err) {
        return next(err);
      }

      debug.getCalls(key + ' -> ' + value);
      next(null, value);
    });
  };

  /**
   * Get the analytics hash key with the given parameters.
   *
   * @param {String} project
   *   The project id to search for.
   * @param {Number} year
   *   The full date year to search for (Date.getUTCFullYear() format).
   * @param {Number} [month]
   *   The full month to search for (Date.getUTCMonth() format).
   * @param {Number} [day]
   *   The full day to search for (Date.getUTCDate() format).
   *
   * @returns {string}
   *   They key used to get/set data for this given set of parameters.
   */
  var getAnalyticsHashKey = function(project, year, month, day) {
    // Create the base redis hash, and extend if applicable.
    var key = 'analytics:' + project + ':' + year;
    if(month) {
      key += ':' + month;

      // Only allow the day query if month was also included.
      if(day) {
        key += ':' + day;
      }
    }

    return key;
  };

  /**
   * Updates a squashed representation of detailed redis data for quick analytics displaying.
   *
   * @param {String} project
   *   The project id to search for.
   * @param {Number} year
   *   The full date year to search for (Date.getUTCFullYear() format).
   * @param {Number} [month]
   *   The full month to search for (Date.getUTCMonth() format).
   * @param {Number} [day]
   *   The full day to search for (Date.getUTCDate() format).
   * @param {Function} next
   *   The callback function to call when the analytics function has been created.
   */
  var updateAnalyticsHash = function(project, year, month, day, oldHash, next) {
    if(!project || !year) {
      debug.updateAnalyticsHash('Quietly failing.');
      return next(null, []);
    }

    // Determine what type of hash we are dealing with: y/m/d
    if(day) {
      debug.updateAnalyticsHash('Daily analytics not supported yet.');
      return next(null, oldHash);
    }
    else if(month) {
      debug.updateAnalyticsHash('Monthly analytics not supported yet.');
      return next(null, oldHash);
    }
    else if(year) {
      debug.updateAnalyticsHash('Yearly analytics not supported yet.');
      return next(null, oldHash);
    }
    else {
      debug.updateAnalyticsHash(
        'Quietly failing, should never get here.. '
        + '\nproject: ' + project
        + '\nyear: ' + year
        + '\nmonth: ' + month
        + '\nday: ' + day
      );
      return next(null, oldHash);
    }
  };

  /**
   * Get the analytics hash from redis with the given key.
   *
   * @param {String} key
   * @param {Function} next
   */
  var getAnalyticsHashByKey = function(key, next) {
    // Quietly fail if requirements aren't present.
    if(!connect() || !key) {
      debug.getAnalyticsHashByKey('Quietly failing.');
      return next(null, []);
    }

    debug.getAnalyticsHashByKey(key);
    redis.hgetall(key, function(err, values) {
      if(err) {
        debug.getAnalyticsHashByKey(err);
        return next(err);
      }

      debug.getAnalyticsHashByKey(values);
      next(null, values);
    });
  };

  /**
   * Get the analytics for display with the given parameters.
   *
   * @param project {String}
   *   The project id to search for.
   * @param year {Number}
   *   The full date year to search for (Date.getUTCFullYear() format).
   * @param [month] {Number}
   *   The full month to search for (Date.getUTCMonth() format).
   * @param [day] {Number}
   *   The full day to search for (Date.getUTCDate() format).
   * @param next {Function}
   *   The callback function to invoke with the analytics information.
   */
  var getDisplayAnalytics = function(project, year, month, day, next) {
    // Quietly fail if requirements aren't present.
    if(!project || !year) {
      debug.getDisplayAnalytics('Quietly failing.');
      return next(null, []);
    }

    var key = getAnalyticsHashKey(project, year, month, day);
    getAnalyticsHashByKey(key, function(err, oldAnalytics) {
      if(err) {
        debug.getDisplayAnalytics('Quietly failing.');
        debug.getDisplayAnalytics(err);
        return next(null, []);
      }

      // Update/create the analytics hash as applicable.
      oldAnalytics = oldAnalytics || [];
      updateAnalyticsHash(project, year, month, day, oldAnalytics, function(err, newAnalytics) {
        if(err) {
          debug.getDisplayAnalytics('Quietly failing w/ error:');
          debug.getDisplayAnalytics(err);
          return next(null, oldAnalytics)
        }

        next(null, newAnalytics);
      });
    });
  };

  /**
   *
   * @param app
   * @param formioServer
   */
  var endpoints = function(app, formioServer) {
    /**
     * Expose the daily api calls for each day of the month.
     */
    app.get(
      '/project/:projectId/analytics/year/:year/month/:month',
      formioServer.formio.middleware.tokenHandler,
      formioServer.formio.middleware.permissionHandler,
      function(req, res, next) {
        if(!req.params.projectId || !req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        getDisplayAnalytics(req.params.projectId, req.params.year, req.params.month, null, function(err, _analytics) {
          if(err) {
            return res.sendStatus(500);
          }

          return res.status(200).json(_analytics);
        });
      }
    );

  };

  /**
   * Expose the redis interface for analytics.
   */
  return {
    getRedis: getRedis,
    connect: connect,
    hook: hook,
    getCalls: getCalls,
    endpoints: endpoints
  };
};
