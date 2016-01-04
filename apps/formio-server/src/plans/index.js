'use strict';

var debug = {
  plans: require('debug')('formio:plans'),
  checkRequest: require('debug')('formio:plans:checkRequest'),
  getPlan: require('debug')('formio:plans:getPlan')
};

module.exports = function(formioServer, cache) {
  var limits = {
    basic: 1000,
    independent: 10000,
    team: 250000,
    commercial: Number.MAX_VALUE
  };

  var basePlan = formioServer.config.plan || 'commercial';
  debug.plans('Base Plan: ' + basePlan);

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
    // Ignore project plans, if not interacting with a project.
    if (!req.projectId) {
      debug.getPlan('No project given.');
      return next(null, basePlan);
    }

    cache.loadProject(req, req.projectId, function(err, project) {
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

  return {
    limits: limits,
    checkRequest: checkRequest,
    getPlan: getPlan,
    getPlans: getPlans
  };
};
