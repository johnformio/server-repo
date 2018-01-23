'use strict';

const onFinished = require('on-finished');
const debug = {
  record: require('debug')('formio:analytics:record'),
  hook: require('debug')('formio:analytics:hook'),
  getCalls: require('debug')('formio:analytics:getCalls'),
  getYearlyAnalytics: require('debug')('formio:analytics:getYearlyAnalytics'),
  getMonthlyAnalytics: require('debug')('formio:analytics:getMonthlyAnalytics'),
  getDailyAnalytics: require('debug')('formio:analytics:getDailyAnalytics'),
  restrictToFormioEmployees: require('debug')('formio:analytics:restrictToFormioEmployees'),
  getFormioFormByName: require('debug')('formio:analytics:getFormioFormByName')
};
const url = require('url');
const submission = /(\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission)/i;
const _ = require('lodash');
const BSON = new RegExp('^[0-9a-fA-F]{24}$');

module.exports = (redis) => {
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
  const getAnalyticsKey = function(project, year, month, day, type) {
    if (!project || !year || (!month && month !== 0) || !day || !type) {
      return null;
    }

    return `${year.toString()}:${month.toString()}:${day.toString()}:${project.toString()}:${
       type.toString()}`;
  };

  /**
   * Express middleware for tracking request analytics.
   *
   * @param redis {Redis}
   *   The Redis connection.
   * @param project {String}
   *   The Project Id of this request.
   * @param path {String}
   *   The requested url for this request.
   * @param method {String}
   *   The http method used for this request.
   * @param start {Number}
   *   The date timestamp this request started.
   */
  const record = function(db, project, path, method, start) {
    if (!db) {
      return;
    }
    if (!project) {
      return;
    }
    if (!method) {
      return;
    }
    if (!path) {
      return;
    }
    if (!_.isString(project) || !BSON.test(project)) {
      return;
    }

    // Update the redis key, dependent on if this is a submission or non-submission request.
    const now = new Date();
    const type = submission.test(path) ? 's' : 'ns';
    const key = getAnalyticsKey(project, now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), type);
    const delta = start
      ? now.getTime() - start
      : 0;
    method = method.toString().toUpperCase();
    const value = `${path}:${method}:${now.getTime()}:${delta}`;

    // Add this record, to the end of the list at the position of the key.
    db.rpush(key, value, function(err, length) {
      if (err) {
        debug.record(err);
        return;
      }
    });
  };

  /**
   * Hook the response and record the event in redis, after the response is sent.
   *
   * @param req
   * @param res
   * @param next
   */
  const hook = function(req, res, next) {
    redis.getDb((err, db) => {
      if (err) {
        return;
      }
      // Attach the request start time.
      req._start = (new Date()).getTime();

      onFinished(res, function(err) {
        if (err) {
          debug.hook(err);
          return;
        }
        if (!req.projectId) {
          return;
        }

        const id = req.projectId;
        const path = url.parse(req.url).pathname;
        const start = req._start;
        record(db, id, path, req.method, start);
      });
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
  const getCalls = function(year, month, day, project, next) {
    redis.getDb((err, db) => {
      if (err || !db || !year || (!month && month !== 0) || !project) {
        return next();
      }

      const transaction = db.multi();

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

        const daysInMonth = (new Date(parseInt(year), parseInt(month)+1, 0)).getUTCDate();
        response = _.sum(response.slice(0, daysInMonth));
        return next(null, response);
      });
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
  const getAllKeys = function(glob, next) {
    redis.getDb((err, db) => {
      if (err || !db) {
        return next();
      }

      let keys = [];

      // Recursively get all the keys matching the glob.
      let started = false;
      (function scan(cursor, cb) {
        if (cursor === '0' && started) {
          return cb();
        }

        if (!started) {
          started = true;
        }

        db.scan(cursor, 'MATCH', glob, function(err, _keys) {
          if (err || !_keys) {
            return cb(err);
          }

          if (_keys[1] &&_keys[1].length > 0) {
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
  const between = function(value, low, high) {
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
   * @param {Object} res
   *   The Express response object.
   */
  const getFormioAnalytics = function(glob, res) {
    // Start the transaction and all the keys in question.
    const transaction = res.redis.multi();
    getAllKeys(glob, function(err, keys) {
      if (err) {
        return res.status(500).send(err);
      }

      // Confirm the keys are unique and add them to the transaction.
      const wrapped = _(keys)
        .uniq()
        .value();

      wrapped.forEach(function(key) {
        transaction.llen(key);
      });

      transaction.exec(function(err, response) {
        if (err) {
          return res.status(500).send(err);
        }

        const final = _(response)
          .zip(wrapped)
          .value();

        return res.status(200).json(final);
      });
    });
  };

  /* eslint-disable max-statements */
  /**
   *
   * @param app
   * @param formioServer
   */
  const endpoints = function(app, formioServer) {
    /**
     * Get the formio form, by name, for consumption elsewhere.
     *
     * @param name
     * @param req
     * @param next
     */
    const getFormioFormByName = function(name, req, next) {
      formioServer.formio.cache.loadProjectByName(req, 'formio', function(err, project) {
        if (err || !project) {
          return next('Could not load Form.io project.');
        }

        try {
          project = project.toObject();
        }
        catch (err) {
          debug.getFormioFormByName(err);
        }

        formioServer.formio.resources.form.model.findOne({project: project._id, name: name}, function(err, form) {
          if (err) {
            return next('Could not load Form.io user resource.');
          }

          try {
            form = form.toObject();
          }
          catch (e) {
            debug.getFormioFormByName(err);
          }

          return next(null, form);
        });
      });
    };

    /**
     * Middleware to restrict an endpoint to formio employees.
     *
     * @param req
     * @param res
     * @param next
     */
    const restrictToFormioEmployees = function(req, res, next) {
      if (!req.user) {
        return res.sendStatus(401);
      }

      formioServer.formio.cache.loadProjectByName(req, 'formio', function(err, project) {
        if (err || !project) {
          return res.sendStatus(401);
        }

        try {
          project = project.toObject();
        }
        catch (err) {
          // project was already a plain js object.
          debug.restrictToFormioEmployees(err);
        }

        // Owner of Formio
        if (req.user._id.toString() === project.owner.toString()) {
          return next();
        }

        formioServer.formio.resources.role.model.findOne({
          project: project._id,
          title: "Administrator",
          deleted: {$eq: null}
        }, function(err, response) {
          if (!err && response) {
            // Admin of Formio.
            if (req.user.roles.indexOf(response.toObject()._id) !== -1) {
              return next();
            }
          }
          // Team member of Formio.
          formioServer.formio.teams.getProjectTeams(req, project._id, function(err, teams, permissions) {
            if (err || !teams || !permissions) {
              return res.sendStatus(401);
            }

            const member = _.some(teams, function(team) {
              if (req.user.roles.indexOf(team) !== -1) {
                return true;
              }

              return false;
            });

            if (member) {
              return next();
            }

            return res.sendStatus(401);
          });
        });
      });
    };

    /**
     * Get the formio projects created using the given query.
     *
     * @param {Object} query
     * @param {Object} res
     */
    const getFormioProjectsCreated = function(query, res) {
      formioServer.formio.resources.project.model.find(query, function(err, projects) {
        if (err) {
          return res.status(500).send(err);
        }

        const final = _(projects)
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
     * @param query
     * @param req
     * @param res
     */
    const getFormioUsersCreated = function(query, req, res) {
      getFormioFormByName('user', req, function(err, form) {
        if (err) {
          return res.status(500).send(err);
        }

        // Attach the user form _id.
        query.form = form._id;

        // Get the submissions.
        formioServer.formio.resources.submission.model.find(query, function(err, users) {
          if (err) {
            return res.status(500).send(err);
          }

          const final = _(users)
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
      });
    };

    /**
     * Get the formio project upgrade history using the given query.
     *
     * @param query
     * @param req
     * @param res
     */
    const getProjectUpgrades = function(query, req, res) {
      getFormioFormByName('projectUpgradeHistory', req, function(err, form) {
        if (err) {
          return res.status(500).send(err);
        }

        // Attach the form _id.
        query.form = formioServer.formio.util.idToBson(form._id);

        formioServer.formio.resources.submission.model.find(query, function(err, upgrades) {
          if (err) {
            return res.status(500).send(err);
          }

          const projects = upgrades.map(function(item) {
            return formioServer.formio.util.idToBson(item.data.projectId);
          });

          formioServer.formio.resources.project.model.aggregate(
            {$match: {_id: {$in: projects}}},
            {$lookup: {
              from: 'submissions',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner'
            }},
            {$unwind: '$owner'},
            {$project: {
              _id: 1,
              plan: 1,
              deleted: 1,
              created: 1,
              modified: 1,
              name: 1,
              title: 1,
              owner: {
                deleted: 1,
                data: {
                  fullName: 1,
                  name: 1,
                  email: 1
                },
                form: 1,
                modified: 1,
                created: 1,
                _id: 1
              }
            }},
            function(err, results) {
              if (err) {
                return res.status(500).send(err);
              }

              const projMap = {};
              results.forEach(function(p) {
                projMap[p._id] = p;
              });

              // Update the original upgrade submissions.
              const final = upgrades.map(function(sub) {
                sub.data.project = projMap[sub.data.projectId];
                delete sub.data.projectId;
                return sub;
              });

              return res.status(200).json(final);
            }
          );
        });
      });
    };

    /**
     * Get the formio project upgrade history using the given query.
     *
     * @param query
     * @param req
     * @param res
     */
    const getProjectsCreated = function(query, req, res) {
      formioServer.formio.resources.project.model.aggregate(
        {$match: query},
        {$lookup: {
          from: 'submissions',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner'
        }},
        {$unwind: '$owner'},
        {$project: {
          _id: 1,
          plan: 1,
          deleted: 1,
          created: 1,
          modified: 1,
          name: 1,
          title: 1,
          owner: {
            deleted: 1,
            data: {
              fullName: 1,
              name: 1,
              email: 1
            },
            form: 1,
            modified: 1,
            created: 1,
            _id: 1
          }
        }},
        function(err, results) {
          if (err) {
            return res.status(500).send(err);
          }

          return res.status(200).json(results);
        }
      );
    };

    /**
     * Expose the monthly api calls for each month of the year.
     */
    app.get(
      '/project/:projectId/analytics/year/:year',
      redis.middleware.bind(redis),
      formioServer.formio.middleware.tokenHandler,
      formioServer.formio.middleware.permissionHandler,
      function(req, res, next) {
        if (!req.params.projectId || !req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }

        const project = req.params.projectId.toString();
        const year = req.params.year.toString();
        const transaction = req.redis.multi();
        for (let month = 0; month < 12; month++) {
          for (let day = 1; day < 32; day++) {
            transaction.llen(getAnalyticsKey(project, year, month, day, 's'));
          }
        }

        transaction.exec(function(err, response) {
          if (err) {
            debug.getYearlyAnalytics(err);
            return res.sendStatus(500);
          }

          const output = [];

          // Slice the response into 12 segments and add the submissions.
          for (let month = 0; month < 12; month++) {
            const monthData = response.slice((month * 31), ((month + 1) * 31));
            const daysInMonth = (new Date(parseInt(year), parseInt(month)+1, 0)).getUTCDate();
            output.push({
              month: month,
              days: daysInMonth,
              submissions: _.sum(monthData)
            });
          }

          return res.status(200).json(output);
        });
      }
    );

    /**
     * Expose the daily api calls for each day of the month.
     */
    app.get(
      '/project/:projectId/analytics/year/:year/month/:month',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      formioServer.formio.middleware.permissionHandler,
      function(req, res, next) {
        if (!req.params.projectId || !req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        const project = req.params.projectId.toString();
        const year = req.params.year.toString();
        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const transaction = req.redis.multi();
        for (let day = 1; day < 32; day++) {
          transaction.llen(getAnalyticsKey(project, year, month, day, 's'));
        }

        transaction.exec(function(err, response) {
          if (err) {
            debug.getMonthlyAnalytics(err);
            return res.sendStatus(500);
          }

          const daysInMonth = (new Date(parseInt(year), parseInt(month)+1, 0)).getUTCDate();
          response = response.slice(0, daysInMonth);

          const output = [];
          for (let day = 0; day < response.length; day++) {
            output.push({
              day: day,
              submissions: response[day]
            });
          }

          return res.status(200).json(output);
        });
      }
    );

    /**
     * Expose the daily api calls for each day of the month.
     */
    app.get(
      '/project/:projectId/analytics/year/:year/month/:month/day/:day',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      formioServer.formio.middleware.permissionHandler,
      function(req, res, next) {
        if (!req.params.projectId || !req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        const project = req.params.projectId.toString();
        const year = req.params.year.toString();
        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const day = req.params.day.toString();
        req.redis.lrange(getAnalyticsKey(project, year, month, day, 's'), 0, -1, function(err, response) {
          if (err) {
            debug.getDailyAnalytics(err);
            return res.sendStatus(500);
          }

          response = _.map(response, function(_request) {
            const parts = _request.split(':');
            return parts[parts.length - 2];
          });
          response = {
            submissions: response
          };

          return res.status(200).json(response);
        });
      }
    );

    app.post(
      '/analytics/translate/project',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.body || !(req.body instanceof Array)) {
          return res.status(500).send('Expected array payload of project _id\'s.');
        }

        const projects = _(req.body)
          .uniq()
          .flattenDeep()
          .filter()
          .value();

        formioServer.formio.resources.project.model.find({_id: {$in: projects}}, function(err, projects) {
          if (err) {
            return res.status(500).send(err);
          }

          projects = _(projects)
            .map(function(project) {
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
        if (!req.body || !(req.body instanceof Array)) {
          return res.status(500).send('Expected array payload of owner _id\'s.');
        }

        const owners = _(req.body)
          .uniq()
          .flattenDeep()
          .filter()
          .value();

        formioServer.formio.cache.loadProjectByName(req, 'formio', function(err, project) {
          if (err || !project) {
            return res.sendStatus(401);
          }

          try {
            project = project.toObject();
          }
          catch (err) {
            // project was already a plain js object.
          }

          formioServer.formio.resources.form.model.findOne({project: project._id, name: 'user'})
            .exec(function(err, form) {
              if (err || !form) {
                return res.status(500).send(err);
              }

              try {
                form = form.toObject();
              }
              catch (err) {
                // n/a
              }

              formioServer.formio.resources.submission.model.find({form: form._id, _id: {$in: owners}})
                .exec(function(err, owners) {
                  if (err) {
                    return res.status(500).send(err);
                  }

                  owners = _(owners)
                    .map(function(owner) {
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
            });
        });
      }
    );

    app.get(
      '/analytics/project/year/:year',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }

        // Build the glob
        const year = req.params.year.toString();
        const glob = getAnalyticsKey('*', year, '*', '*', '*');

        // Get the data and respond.
        getFormioAnalytics(glob, res);
      }
    );

    app.get(
      '/analytics/project/year/:year/month/:month',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Build the glob.
        const year = req.params.year.toString();
        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const glob = getAnalyticsKey('*', year, month, '*', '*');

        // Get the data and respond.
        getFormioAnalytics(glob, res);
      }
    );

    app.get(
      '/analytics/project/year/:year/month/:month/day/:day',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        // Build the glob.
        const year = req.params.year.toString();
        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const day = req.params.day.toString();
        const glob = getAnalyticsKey('*', year, month, day, '*');

        // Get the data and respond.
        getFormioAnalytics(glob, res);
      }
    );

    app.get(
      '/analytics/created/projects/year/:year',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }

        const query = {
          created: {
            $gte: new Date(req.params.year.toString()),
            $lt: new Date((req.params.year + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioProjectsCreated(query, res);
      }
    );

    app.get(
      '/analytics/created/projects/year/:year/month/:month',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
            $lt: new Date(req.params.year.toString(), (req.params.month).toString())
          }
        };

        // Get the data and respond.
        getFormioProjectsCreated(query, res);
      }
    );

    app.get(
      '/analytics/created/projects/year/:year/month/:month/day/:day',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
            $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioProjectsCreated(query, res);
      }
    );

    app.get(
      '/analytics/created/users/year/:year',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }

        const query = {
          created: {
            $gte: new Date(req.params.year.toString()),
            $lt: new Date((req.params.year + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/created/users/year/:year/month/:month',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
            $lt: new Date(req.params.year.toString(), (req.params.month).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/created/users/year/:year/month/:month/day/:day',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
            $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/upgrades/projects/year/:year',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }

        const query = {
          created: {
            $gte: new Date(req.params.year.toString()),
            $lt: new Date((req.params.year + 1).toString())
          }
        };

        // Get the data and respond.
        getProjectUpgrades(query, req, res);
      }
    );

    app.get(
      '/analytics/upgrades/projects/year/:year/month/:month',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
            $lt: new Date(req.params.year.toString(), (req.params.month).toString())
          }
        };

        // Get the data and respond.
        getProjectUpgrades(query, req, res);
      }
    );

    app.get(
      '/analytics/upgrades/projects/year/:year/month/:month/day/:day',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
            $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
          }
        };

        // Get the data and respond.
        getProjectUpgrades(query, req, res);
      }
    );

    app.get(
      '/analytics/total/projects/year/:year',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }

        const query = {
          created: {
            $lt: new Date((req.params.year + 1).toString())
          }
        };

        // Get the data and respond.
        getProjectsCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/total/projects/year/:year/month/:month',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $lt: new Date(req.params.year.toString(), (req.params.month - 1).toString())
          }
        };

        // Get the data and respond.
        getProjectsCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/total/projects/year/:year/month/:month/day/:day',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
          }
        };

        // Get the data and respond.
        getProjectsCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/total/users/year/:year',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year) {
          return res.status(400).send('Expected params `year`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }

        const query = {
          created: {
            $lt: new Date((req.params.year + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/total/users/year/:year/month/:month',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month) {
          return res.status(400).send('Expected params `year` and `month`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1-12.');
        }

        // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $lt: new Date(req.params.year.toString(), (req.params.month).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, req, res);
      }
    );

    app.get(
      '/analytics/total/users/year/:year/month/:month/day/:day',
      (req, res, next) => redis.middleware(req, res, next),
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        if (!req.params.year || !req.params.month || !req.params.day) {
          return res.status(400).send('Expected params `year`, `month`, and `day`.');
        }

        // Param validation.
        const curr = new Date();
        req.params.year = parseInt(req.params.year);
        req.params.month = parseInt(req.params.month);
        req.params.day = parseInt(req.params.day);
        if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
          return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
        }
        if (!between(req.params.month, 1, 12)) {
          return res.status(400).send('Expected a month in the range of 1 - 12.');
        }
        if (!between(req.params.day, 1, 31)) {
          return res.status(400).send('Expected a day in the range of 1 - 31.');
        }

        const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
        const query = {
          created: {
            $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
          }
        };

        // Get the data and respond.
        getFormioUsersCreated(query, req, res);
      }
    );

    app.put(
      '/analytics/upgrade',
      formioServer.formio.middleware.tokenHandler,
      restrictToFormioEmployees,
      function(req, res, next) {
        const plans = ['basic', 'independent', 'team', 'commercial', 'trial'];
        if (!req.body || !req.body.project || !req.body.plan) {
          return res.status(400).send('Expected params `project` and `plan`.');
        }
        if (plans.indexOf(req.body.plan) === -1) {
          return res.status(400).send(`Expexted \`plan\` of type: ${plans.join(',')}.`);
        }

        formioServer.formio.resources.project.model.update({
          _id: formioServer.formio.util.idToBson(req.body.project),
          deleted: {$eq: null}
        }, {$set: {plan: req.body.plan}}, function(err, results) {
          if (err) {
            return res.status(400).send(err);
          }

          return res.sendStatus(200);
        });
      }
    );
  };
  /* eslint-enable max-statements */

  /**
   * Expose the redis interface for analytics.
   */
  return {
    hook: hook,
    getCalls: getCalls,
    getAnalyticsKey: getAnalyticsKey,
    endpoints: endpoints
  };
};
