'use strict';

var _ = require('lodash');
var debug = {
  plans: require('debug')('formio:plans'),
  checkRequest: require('debug')('formio:plans:checkRequest'),
  getPlan: require('debug')('formio:plans:getPlan'),
  allowForPlans: require('debug')('formio:plans:allowForPlans'),
  disableForPlans: require('debug')('formio:plans:disableForPlans')
};

module.exports = function(formioServer, cache) {
  var limits = {
    basic: 1000,
    independent: 10000,
    team: 250000,
    trial: 250000,
    commercial: Number.MAX_VALUE
  };

  var basePlan = formioServer.config.plan || 'commercial';
  debug.plans('Base Plan: ' + basePlan);

  /**
   * After loading, determine the plan from the projec
   * @param err
   * @param project
   * @returns {*|{done, value}}
   */
  var getProjectPlan = function(err, project, next) {
    if (err || !project) {
      debug.getPlan(err || 'Project not found.');
      return next(err || 'Project not found.');
    }

    if (project.primary && project.primary === true) {
      debug.getPlan('commercial');
      return next(null, 'commercial', project);
    }

    // Only allow plans defined within the limits definition.
    if (project.plan && limits.hasOwnProperty(project.plan)) {
      debug.getPlan('has plan');
      debug.getPlan(project.plan);
      return next(null, project.plan, project);
    }

    // Default the project to the basePlan plan if not defined in the limits.
    debug.getPlan('using default');
    debug.getPlan(basePlan);
    return next(null, basePlan, project);
  };

  /**
   * Get the plan for the project in the request.
   *
   * Project plan names limited to those inside the limits obj and 'formio'.
   *
   * @param req {Object}
   *   The Express request object.
   * @param next {Function}
   *   The callback to invoke with the results.
   * @returns {*}
   */
  var getPlan = function(req, next) {
    // Environment Create is tricky as we have to use permissions of the referenced project before it exists.
    if (req.method === 'POST' && req.path === '/project' && req.body.hasOwnProperty('project')) {
      debug.getPlan('Project from environment create.');
      return cache.loadProject(req, req.body.project, function(err, project) {
        return getProjectPlan(err, project, next);
      });
    }

    // Ignore project plans, if not interacting with a project.
    if (!req.projectId) {
      debug.getPlan('No project given.');
      return next(null, basePlan);
    }

    cache.loadPrimaryProject(req, function(err, project) {
      getProjectPlan(err, project, next);
    });
  };

  var checkRequest = function(req, res) {
    return function(cb) {
      getPlan(req, function(err, plan, project) {
        // Ignore project plans, if not interacting with a project.
        if (!err && !project) {
          debug.checkRequest('Skipping project plans, not interacting with a project..');
          return cb();
        }

        if (err) {
          debug.checkRequest(err);
          return cb(err);
        }

        var curr = new Date();
        var _plan = limits[plan];

        // Ignore limits for the formio project.
        if (project.hasOwnProperty('name') && project.name && project.name === 'formio') {
          return cb();
        }

        // Check the calls made this month.
        var year = curr.getUTCFullYear();
        var month = curr.getUTCMonth();
        formioServer.analytics.getCalls(year, month, null, project._id, function(err, calls) {
          if (err) {
            debug.checkRequest(err);
            return cb(err);
          }

          debug.checkRequest(
            'API Calls for y/m/d: ' + year + '/' + month + '/* and project: '
            + project._id + ' -> ' + calls
          );
          if (calls >= _plan) {
            process.nextTick(function() {
              debug.checkRequest('Monthly limit exceeded..');
              return cb();
            });
          }
          else {
            return cb();
          }
        });
      });
    };
  };

  /**
   * Returns an array of all the plan types
   */
  var getPlans = function() {
    return Object.keys(limits);
  };

  /**
   * Utility function to allow project based endpoints depending on the project plan.
   *
   * @param {Array|String} plans
   *   An array of plans to allow
   *
   * @returns {Function}
   */
  var allowForPlans = function(plans) {
    if (!(plans instanceof Array)) {
      plans = [plans];
    }

    debug.allowForPlans(plans);
    return function(req, res, next) {
      if (process.env.DISABLE_RESTRICTIONS) {
        return next();
      }
      getPlan(req, function(err, plan) {
        if (err) {
          debug.allowForPlans(err);
          return res.sendStatus(402);
        }

        if (plans.indexOf(plan) === -1) {
          debug.allowForPlans(plan + ' not found in whitelist: ' + plans.join(', '));
          return res.sendStatus(402);
        }

        return next();
      });
    };
  };

  /**
   * Utility function to block project based endpoints depending on the project plan.
   *
   * @param {Array|String} plans
   *   An array of plans to disallow
   *
   * @returns {Function}
   */
  var disableForPlans = function(plans) {
    if (!(plans instanceof Array)) {
      plans = [plans];
    }

    var allow = _.difference(getPlans(), plans);
    debug.disableForPlans('Inverting blacklist: ' + allow.join(', '));
    return allowForPlans(allow);
  };

  return {
    limits: limits,
    checkRequest: checkRequest,
    getPlan: getPlan,
    getPlans: getPlans,
    allowForPlans: allowForPlans,
    disableForPlans: disableForPlans
  };
};
