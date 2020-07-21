'use strict';

const _ = require('lodash');
const plans = require('./plans');

const debug = {
  plans: require('debug')('formio:plans'),
  getPlan: require('debug')('formio:plans:getPlan'),
  allowForPlans: require('debug')('formio:plans:allowForPlans'),
  disableForPlans: require('debug')('formio:plans:disableForPlans')
};

module.exports = function(formioServer) {
  const basePlan = formioServer.config.plan || 'commercial';
  debug.plans(`Base Plan: ${basePlan}`);

  /**
   * After loading, determine the plan from the project
   * @param err
   * @param project
   * @returns {*|{done, value}}
   */
  const getProjectPlan = function(err, project, currentProject, next) {
    if (err || !project) {
      debug.getPlan(err || 'Project not found.');
      return next(err || 'Project not found.');
    }

    // Only allow plans defined within the plans definition.
    if (project.plan && plans.hasOwnProperty(project.plan)) {
      debug.getPlan('has plan');
      debug.getPlan(project.plan);
      return next(null, project.plan, project, currentProject);
    }

    // Default the project to the basePlan plan if not defined in the plans.
    debug.getPlan('using default');
    debug.getPlan(basePlan);
    return next(null, basePlan, project, currentProject);
  };

  /**
   * Get the plan for the project in the request.
   *
   * Project plan names limited to those inside the plans obj and 'formio'.
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
          return getProjectPlan(err, project, null, next);
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

    formioServer.formio.cache.loadCurrentProject(req, function(err, currentProject) {
      formioServer.formio.cache.loadPrimaryProject(req, function(err, project) {
        getProjectPlan(err, project, currentProject, next);
      });
    });
  };

  /**
   * Returns an array of all the plan types
   */
  const getPlans = function() {
    return Object.keys(plans);
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
    getPlan: getPlan,
    getPlans: getPlans,
    allowForPlans: allowForPlans,
    disableForPlans: disableForPlans
  };
};
