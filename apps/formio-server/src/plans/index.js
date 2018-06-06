'use strict';

const _ = require('lodash');
const debug = {
  plans: require('debug')('formio:plans'),
  checkRequest: require('debug')('formio:plans:checkRequest'),
  getPlan: require('debug')('formio:plans:getPlan'),
  allowForPlans: require('debug')('formio:plans:allowForPlans'),
  disableForPlans: require('debug')('formio:plans:disableForPlans')
};

module.exports = function(formioServer) {
  const limits = {
    basic: 1000,
    independent: 10000,
    team: 250000,
    trial: 10000,
    commercial: 2000000
  };

  const basePlan = formioServer.config.plan || 'commercial';
  debug.plans(`Base Plan: ${basePlan}`);

  /**
   * After loading, determine the plan from the projec
   * @param err
   * @param project
   * @returns {*|{done, value}}
   */
  const getProjectPlan = function(err, project, next) {
    if (err || !project) {
      debug.getPlan(err || 'Project not found.');
      return next(err || 'Project not found.');
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
  const getPlan = function(req, next) {
    if (req.method === 'POST' && req.path === '/project') {
      // Environment Create is tricky as we have to use permissions of the referenced project before it exists.
      if (req.body.hasOwnProperty('project')) {
        debug.getPlan('Project from environment create.');
        return formioServer.formio.cache.loadProject(req, req.body.project, function(err, project) {
          return getProjectPlan(err, project, next);
        });
      }

      // Allow admins to set plan.
      if (req.body.plan && req.isAdmin) {
        return next(null, req.body.plan);
      }
    }

    // Ignore project plans, if not interacting with a project.
    if (!req.projectId) {
      debug.getPlan('No project given.');
      return next(null, basePlan);
    }

    formioServer.formio.cache.loadPrimaryProject(req, function(err, project) {
      getProjectPlan(err, project, next);
    });
  };

  const checkRequest = function(req) {
    return function(cb) {
      getPlan(req, function(err, plan, project) {
        // Ignore project plans, if not interacting with a project.
        if (!err && !project) {
          return cb();
        }

        if (err) {
          return cb(err);
        }

        const curr = new Date();
        const _plan = limits[plan];

        // Determine if this project has gone above its limits.
        if (_.get(project, 'billing.calls', 0) > _plan) {
          // Create a penalty to throw their request to the back of the request queue.
          process.nextTick(function() {
            debug.checkRequest('Monthly limit exceeded..');
            return cb();
          });
        }
        else {
          /* eslint-disable callback-return */
          cb();
          /* eslint-enable callback-return */
        }

        // Ignore limits for the formio project.
        if (project.hasOwnProperty('name') && project.name && project.name === 'formio') {
          return;
        }

        // Check the calls made this month.
        const year = curr.getUTCFullYear();
        const month = curr.getUTCMonth();
        formioServer.analytics.getCalls(year, month, null, project._id, function(err, calls) {
          if (err) {
            return;
          }

          const exceeds = (calls >= _plan);
          const lastChecked = _.get(project, 'billing.checked', 0);
          const currentCalls = _.get(project, 'billing.calls', 0);
          const now = Math.floor(Date.now() / 1000);

          // If the project has no calls, then we can check every minute, otherwise update every hour.
          if ((!currentCalls && ((now - lastChecked) > 60)) || ((now - lastChecked) > 3600)) {
            _.set(project, 'billing.calls', calls);
            _.set(project, 'billing.exceeds', exceeds);
            _.set(project, 'billing.checked', now);
            formioServer.formio.resources.project.model.update({
              _id: formioServer.formio.mongoose.Types.ObjectId(project._id.toString())
            }, {$set: {'billing': project.billing}}, (err, result) => {
              debug.checkRequest('Updated project billing.');
            });
          }
        });
      });
    };
  };

  /**
   * Returns an array of all the plan types
   */
  const getPlans = function() {
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
  const allowForPlans = function(plans) {
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
          debug.allowForPlans(`${plan} not found in whitelist: ${plans.join(', ')}`);
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
  const disableForPlans = function(plans) {
    if (!(plans instanceof Array)) {
      plans = [plans];
    }

    const allow = _.difference(getPlans(), plans);
    debug.disableForPlans(`Inverting blacklist: ${allow.join(', ')}`);
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
