'use strict';

var Redis = require('redis');
var onFinished = require('on-finished');
var debug = {
  connect: require('debug')('formio:analytics:connect'),
  record: require('debug')('formio:analytics:record'),
  hook: require('debug')('formio:analytics:hook'),
  getCalls: require('debug')('formio:analytics:getCalls'),
  getYearlyAnalytics: require('debug')('formio:analytics:getYearlyAnalytics'),
  getMonthlyAnalytics: require('debug')('formio:analytics:getMonthlyAnalytics'),
  getDailyAnalytics: require('debug')('formio:analytics:getDailyAnalytics'),
  restrictToFormioEmployees: require('debug')('formio:analytics:restrictToFormioEmployees')
};
var url = require('url');
var submission = /(\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission)/i;
var _ = require('lodash');

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
        /* eslint-disable */
        opts.auth_pass = config.redis.password;
        /* eslint-enable */
      }

      // Attempt to connect to redis 1 time only.
      redis = Redis.createClient(config.redis.port, config.redis.address, opts);
      /* eslint-disable */
      redis.max_attempts = 1;
      /* eslint-enable */

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
   * Util function to build the analytics key with the given params.
   *
   * @param {String} project
   *   The project _id.
   * @param {String} year
   *   The year in utc time (YYYY).
   * @param {String} month
   *   The month in utc time (0-11).
   * @param {String} day
   *   The day in utc time (1-31).
   * @param {String} type
   *   The type of request (ns/s).
   *
   * @returns {String|Null}
   *   The redis key for the given params.
   */
  var getAnalyticsKey = function(project, year, month, day, type) {
    if (!project || !year || (!month && month !== 0) || !day || !type) {
      return null;
    }

    return year.toString() + ':' + month.toString() + ':' + day.toString() + ':' + project.toString() + ':'
      + type.toString();
  };

  /**
   * Express middleware for tracking request analytics.
   *
   * @param project {String}
   *   The Project Id of this request.
   * @param path {String}
   *   The requested url for this request.
   * @param method {String}
   *   The http method used for this request.
   * @param start {Number}
   *   The date timestamp this request started.
   */
  var record = function(project, path, method, start) {
    if (!connect()) {
      debug.record('Skipping, redis not found.');
      return;
    }
    if (!project) {
      debug.record('Skipping non-project request: ' + path);
      return;
    }
    if (!method) {
      debug.record('Skipping request, unknown method: ' + method);
      return;
    }
    if (!path) {
      debug.record('Skipping request, unknown path: ' + path);
      return;
    }

    // Update the redis key, dependent on if this is a submission or non-submission request.
    var now = new Date();
    var type = submission.test(path) ? 's' : 'ns';
    var key = getAnalyticsKey(project, now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), type);

    debug.record('Start: ' + start);
    debug.record('dt: ' + (now.getTime() - Number.parseInt(start, 10)).toString());
    var delta = start
      ? now.getTime() - start
      : 0;
    method = method.toString().toUpperCase();
    var value = path + ':' + method + ':' + now.getTime() + ':' + delta;

    // Add this record, to the end of the list at the position of the key.
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
      record(id, path, req.method, start);
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
    if (!connect() || !year || (!month && month !== 0) || !project) {
      debug.getCalls('Skipping');
      return next();
    }

    var transaction = redis.multi();

    if (!day) {
      for (day = 1; day < 32; day++) {
        transaction.llen(getAnalyticsKey(project, year, month, day, 's'));
      }
    }
    else {
      transaction.llen(getAnalyticsKey(project, year, month, day, 's'));
    }

    transaction.exec(function(err, response) {
      if (err) {
        debug.getCalls(err);
        return next();
      }

      debug.getCalls('RAW: ' + JSON.stringify(response));
      var daysInMonth = (new Date(parseInt(year), parseInt(month)+1, 0)).getUTCDate();
      response = _.sum(response.slice(0, daysInMonth));
      return next(null, response);
    });
  };

  /**
   * Recursively get all the redis keys matching the glob.
   *
   * @param {String} glob
   *   The glob pattern to match.
   * @param {Function} next
   *   The callback function to invoke when complete.
   */
  var getAllKeys = function(glob, next) {
    var _debug = require('debug')('formio:analytics:getAllKeys');
    var keys = [];

    // Recursively get all the keys matching the glob.
    var started = false;
    (function scan(cursor, cb) {
      _debug(cursor);
      if (cursor === '0' && started) {
        return cb();
      }

      if (!started) {
        _debug('started=true');
        started = true;
      }

      redis.scan(cursor, 'MATCH', glob, function(err, _keys) {
        if (err || !_keys) {
          _debug(cursor + ',' + glob);
          return cb(err);
        }

        if (_keys[1] &&_keys[1].length > 0) {
          _debug(_keys[1]);
          keys = keys.concat(_keys[1]);
        }

        return scan(_keys[0], cb);
      });
    })('0', function(err) {
      if (err) {
        return next(err);
      }

      next(null, keys);
    });
  };

  /**
   * Check if the given value is inclusively between the range of low and high.
   *
   * @param {Number} value
   *   The value to compare.
   * @param {Number} low
   *   The lowest inclusive number for acceptance.
   * @param {Number} high
   *   The highest inclusive number for acceptance.
   *
   * @returns {boolean}
   *   If the given value is in the range of low to high.
   */
  var between = function(value, low, high) {
    if (!value || !low || !high) {
      return false;
    }

    value = parseInt(value);
    low = parseInt(low);
    high = parseInt(high);

    if (value >= low && value <= high) {
      return true;
    }
    else {
      return false;
    }
  };

  /**
   * Get the formio analytics using the given glob and a redis transaction, and dump to json.
   *
   * @param {String} glob
   *   The glob pattern to match.
   * @param {Object} _debug
   *   The debug object for logging.
   * @param {Object} res
   *   The Express response object.
   */
  var getFormioAnalytics = function(glob, _debug, res) {
    // Start the transaction and all the keys in question.
    var transaction = redis.multi();
    getAllKeys(glob, function(err, keys) {
      if (err) {
        _debug(err);
        return res.status(500).send(err);
      }

      // Confirm the keys are unique and add them to the transaction.
      var wrapped = _(keys)
        .uniq()
        .forEach(function(key) {
          transaction.llen(key);
        })
        .value();

      transaction.exec(function(err, response) {
        if (err) {
          _debug(err);
          return res.status(500).send(err);
        }

        _debug('RAW: ' + JSON.stringify(response));
        var final = _(response)
          .zip(wrapped)
          .value();

        return res.status(200).json(final);
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
     * Middleware to restrict an endpoint to formio employees.
     *
     * @param req
     * @param res
     * @param next
     */
    var restrictToFormioEmployees = function(req, res, next) {
      if (!req.user) {
        debug.restrictToFormioEmployees('No req.user: ' + JSON.stringify(req.user));
        return res.sendStatus(401);
      }

      var cache = require('../cache/cache')(formioServer.formio);
      cache.loadProject(req, '553db92f72f702e714dd9778', function(err, project) {
        if (err || !project) {
          debug.restrictToFormioEmployees('err: ' + err);
          debug.restrictToFormioEmployees('project: ' + project);
          return res.sendStatus(401);
        }

        // Owner of Formio
        if (req.user._id.toString() === project.owner.toString()) {
          return next();
        }

        // Admin of Formio.
        if (req.user.roles.indexOf('55cd5c3ca51a96bef99ef550') !== -1) {
          return next();
        }

        // Team member of Formio.
        formioServer.formio.teams.getProjectTeams(req, '553db92f72f702e714dd9778', function(err, teams, permissions) {
          if (err || !teams || !permissions) {
            debug.restrictToFormioEmployees('err: ' + err);
            debug.restrictToFormioEmployees('teams: ' + teams);
            debug.restrictToFormioEmployees('permissions: ' + permissions);
            return res.sendStatus(401);
          }

          debug.restrictToFormioEmployees('req.user: ' + JSON.stringify(req.user));
          debug.restrictToFormioEmployees('teams: ' + JSON.stringify(teams));

          var member = _.any(teams, function(team) {
            debug.restrictToFormioEmployees('req.user.roles.indexOf(' + team + '): ' + req.user.roles.indexOf(team));
            if (req.user.roles.indexOf(team) !== -1) {
              return true;
            }

            return false;
          });

          if (member) {
            return next();
          }

          debug.restrictToFormioEmployees('Denied');
          debug.restrictToFormioEmployees('Member: ' + member);
          return res.sendStatus(401);
        });
      });
    };

    /**
     * Get the formio projects created using the given query.
     *
     * @param {Object} query
     * @param {Object} res
     */
    var getFormioProjectsCreated = function(query, _debug, res) {
      _debug(query);
      formioServer.formio.resources.project.model.find(query, function(err, projects) {
        if (err) {
          return res.status(500).send(err);
        }

        var final = _(projects)
          .map(function(project) {
            return {
              _id: project._id,
              name: project.name,
              title: project.title,
              description: project.description || '',
              created: project.created,
              owner: project.owner,
              deleted: project.deleted || null,
              plan: project.plan
            };
          })
          .value();

        res.status(200).json(final);
      });
    };

    /**
     * Get the formio users created using the given query.
     *
     * @param {Object} query
     * @param {Object} res
     */
    var getFormioUsersCreated = function(query, _debug, res) {
      if (!query.form) {
        query.form = '553db94e72f702e714dd9779';
      }

      _debug(query);
      formioServer.formio.resources.submission.model.find(query, function(err, users) {
        if (err) {
          return res.status(500).send(err);
        }

        var final = _(users)
          .map(function(user) {
            return {
              _id: user._id,
              data: {
                email: (user.data && user.data.email) || '',
                name: (user.data && user.data.name) || '',
                fullName: (user.data && user.data.fullName) || ''
              },
              created: user.created,
              deleted: user.deleted || null
            };
          })
          .value();

        res.status(200).json(final);
      });
    };

    /**
     * Expose the monthly api calls for each month of the year.
     */
    app.get(
      '/project/:projectId/analytics/year/:year',
      formioServer.formio.middleware.tokenHandler,
      formioServer.formio.middleware.permissionHandler,
      function(req, res, next) {
        if (!connect() || !req.params.projectId || !req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }

        var project = req.params.projectId.toString();
        var year = req.params.year.toString();
        var transaction = redis.multi();
        for (var month = 0; month < 12; month++) {
          for (var day = 1; day < 32; day++) {
            transaction.llen(getAnalyticsKey(project, year, month, day, 's'));
          }
        }

        transaction.exec(function(err, response) {
          if (err) {
            debug.getYearlyAnalytics(err);
            return res.sendStatus(500);
          }

          debug.getYearlyAnalytics('RAW: ' + JSON.stringify(response));
          var output = [];

          // Slice the response into 12 segments and add the submissions.
          for (var month = 0; month < 12; month++) {
            var monthData = response.slice((month * 31), ((month + 1) * 31));
            var daysInMonth = (new Date(parseInt(year), parseInt(month)+1, 0)).getUTCDate();

            debug.getYearlyAnalytics('Month ' + month + ', RAW: ' + JSON.stringify(monthData));
            output.push({
              month: month,
              days: daysInMonth,
              submissions: _.sum(monthData)
            });
          }

          debug.getYearlyAnalytics(output);
          return res.status(200).json(output);
        });
      }
    );

    /**
     * Expose the daily api calls for each day of the month.
     */
    app.get(
      '/project/:projectId/analytics/year/:year/month/:month',
      formioServer.formio.middleware.tokenHandler,
      formioServer.formio.middleware.permissionHandler,
      function(req, res, next) {
        if (!connect() || !req.params.projectId || !req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        var project = req.params.projectId.toString();
        var year = req.params.year.toString();
        var month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        var transaction = redis.multi();
        for (var day = 1; day < 32; day++) {
          transaction.llen(getAnalyticsKey(project, year, month, day, 's'));
        }

        transaction.exec(function(err, response) {
          if (err) {
            debug.getMonthlyAnalytics(err);
            return res.sendStatus(500);
          }

          debug.getMonthlyAnalytics('RAW: ' + JSON.stringify(response));
          var daysInMonth = (new Date(parseInt(year), parseInt(month)+1, 0)).getUTCDate();
          response = response.slice(0, daysInMonth);

          var output = [];
          for (var day = 0; day < response.length; day++) {
            output.push({
              day: day,
              submissions: response[day]
            });
          }

          debug.getMonthlyAnalytics(output);
          return res.status(200).json(output);
        });
      }
    );

    /**
     * Expose the daily api calls for each day of the month.
     */
    app.get(
      '/project/:projectId/analytics/year/:year/month/:month/day/:day',
      formioServer.formio.middleware.tokenHandler,
      formioServer.formio.middleware.permissionHandler,
      function(req, res, next) {
        if (!connect() || !req.params.projectId || !req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015 - ' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        var project = req.params.projectId.toString();
        var year = req.params.year.toString();
        var month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        var day = req.params.day.toString();
        redis.lrange(getAnalyticsKey(project, year, month, day, 's'), 0, -1, function(err, response) {
          if (err) {
            debug.getDailyAnalytics(err);
            return res.sendStatus(500);
          }

          debug.getDailyAnalytics('RAW: ' + JSON.stringify(response));
          response = _.map(response, function(_request) {
            var parts = _request.split(':');
            return parts[parts.length - 2];
          });
          response = {
            submissions: response
          };

          debug.getDailyAnalytics(response);
          return res.status(200).json(response);
        });
      }
    );

    app.post(
      '/analytics/translate/project',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:tranlateProjects');
        if (!req.body || !(req.body instanceof Array)) {
          return res.status(500).send('Expected array payload of project _id\'s.');
        }

        var projects = _(req.body)
          .uniq()
          .flattenDeep()
          .filter()
          .value();
        _debug(projects);

        formioServer.formio.resources.project.model.find({_id: {$in: projects}}, function(err, projects) {
          if (err) {
            _debug(err);
            return res.status(500).send(err);
          }

          projects = _(projects)
            .map(function(project) {
              _debug(project);
              return {
                _id: project._id.toString(),
                name: project.name.toString() || '',
                title: project.title.toString() || '',
                plan: project.plan.toString(),
                owner: project.owner.toString(),
                created: project.created.toString()
              };
            })
            .value();

          return res.status(200).json(projects);
        });
      }
    );

    app.post(
      '/analytics/translate/owner',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:tranlateOwner');
        if (!req.body || !(req.body instanceof Array)) {
          return res.status(500).send('Expected array payload of owner _id\'s.');
        }

        var owners = _(req.body)
          .uniq()
          .flattenDeep()
          .filter()
          .value();
        _debug(owners);

        formioServer.formio.resources.submission.model.find({form: '553db94e72f702e714dd9779', _id: {$in: owners}})
        .exec(function(err, owners) {
          if (err) {
            _debug(err);
            return res.status(500).send(err);
          }

          owners = _(owners)
            .map(function(owner) {
              _debug(owner);
              return {
                _id: owner._id.toString(),
                data: {
                  email: owner.data.email.toString() || '',
                  name: owner.data.name.toString() || ''
                }
              };
            })
            .value();

          return res.status(200).json(owners);
        });
      }
    );

    app.get(
      '/analytics/project/year/:year',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:getFormioYearAnalytics');
        if (!connect() || !req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }

        // Build the glob
        var year = req.params.year.toString();
        var glob = getAnalyticsKey('*', year, '*', '*', '*');

        // Get the data and respond.
        getFormioAnalytics(glob, _debug, res);
      }
    );

    app.get(
      '/analytics/project/year/:year/month/:month',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:getFormioMonthAnalytics');
        if (!connect() || !req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Build the glob.
        var year = req.params.year.toString();
        var month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        var glob = getAnalyticsKey('*', year, month, '*', '*');

        // Get the data and respond.
        getFormioAnalytics(glob, _debug, res);
      }
    );

    app.get(
      '/analytics/project/year/:year/month/:month/day/:day',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:getFormioDayAnalytics');
        if (!connect() || !req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015 - ' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        // Build the glob.
        var year = req.params.year.toString();
        var month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        var day = req.params.day.toString();
        var glob = getAnalyticsKey('*', year, month, day, '*');

        // Get the data and respond.
        getFormioAnalytics(glob, _debug, res);
      }
    );

    app.get(
      '/analytics/created/projects/year/:year',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:yearlyProjectsCreated');
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }

        var query = {
          created: {
            $gte: new Date(req.params.year.toString()),
            $lt: new Date((req.params.year + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioProjectsCreated(query, _debug, res);
      }
    );

    app.get(
      '/analytics/created/projects/year/:year/month/:month',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:monthlyProjectsCreated');
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Adjust the month for zero index in timestamp.
        var query = {
          created: {
            $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
            $lt: new Date(req.params.year.toString(), (req.params.month).toString())
          }
        };

        // Get the data and respond.
        getFormioProjectsCreated(query, _debug, res);
      }
    );

    app.get(
      '/analytics/created/projects/year/:year/month/:month/day/:day',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:dailyProjectsCreated');
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015 - ' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        var month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        var query = {
          created: {
            $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
            $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioProjectsCreated(query, _debug, res);
      }
    );

    app.get(
      '/analytics/created/users/year/:year',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:yearlyUsersCreated');
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }

        var query = {
          created: {
            $gte: new Date(req.params.year.toString()),
            $lt: new Date((req.params.year + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, _debug, res);
      }
    );

    app.get(
      '/analytics/created/users/year/:year/month/:month',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:monthlyUsersCreated');
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015-' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Adjust the month for zero index in timestamp.
        var query = {
          created: {
            $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
            $lt: new Date(req.params.year.toString(), (req.params.month).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, _debug, res);
      }
    );

    app.get(
      '/analytics/created/users/year/:year/month/:month/day/:day',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        var _debug = require('debug')('formio:analytics:dailyUsersCreated');
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        var curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send('Expected a year in the range of 2015 - ' + curr.getUTCFullYear() + '.');
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        var month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        var query = {
          created: {
            $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
            $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, _debug, res);
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
    getAnalyticsKey: getAnalyticsKey,
    endpoints: endpoints
  };
};
