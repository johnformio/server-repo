'use strict';

const config = require('../../config.js');
const _ = require('lodash');
const url = require('url');

const {isSuperAdmin} = require('../util/util');
const ALL_PLAN_LIMITS = require('../usage/limits');
const PLAN_NAMES = Object.keys(ALL_PLAN_LIMITS);
const debug = {
  plans: require('debug')('formio:plans'),
  getPlan: require('debug')('formio:plans:getPlan'),
  allowForPlans: require('debug')('formio:plans:allowForPlans'),
  disableForPlans: require('debug')('formio:plans:disableForPlans'),
  checkRequest: require('debug')('formio:plans:checkRequest')
};

module.exports = function(formioServer) {
  const getBasePlan = () => formioServer.config.plan || 'commercial';

  debug.plans(`Base Plan: ${getBasePlan()}`);

  /**
   * After loading, determine the plan from the project
   * @param project
   * @returns {*|{done, value}}
   */
  const getProjectPlan = function(project, currentProject) {
    if (!project) {
      debug.getPlan('Project not found.');
      return {error: 'Project not found.'};
    }

    // Only allow plans defined within the plans definition.
    if (project.plan && ALL_PLAN_LIMITS.hasOwnProperty(project.plan)) {
      debug.getPlan('has plan');
      debug.getPlan(project.plan);
      return {
        plan: project.plan,
        project: project,
        currentProject: currentProject
      };
    }

    // Default the project to the basePlan plan if not defined in the plans.
    debug.getPlan('using default');
    debug.getPlan(getBasePlan());
    return  {
      plan: getBasePlan(),
      project: project,
      currentProject: currentProject
    };
  };

  /**
   * Get the plan for the project in the request.
   *
   * Project plan names limited to those inside the plans obj and 'formio'.
   *
   * @param req {Object}
   *   The Express request object.
   * @returns {*}
   */
  const getPlan = async function(req) {
    if (req.method === 'POST' && req.path === '/project') {
      // Environment Create is tricky as we have to use permissions of the referenced project before it exists.
      if (req.body.hasOwnProperty('project')) {
        debug.getPlan('Project from environment create.');
        try {
          const project = await formioServer.formio.cache.loadProject(req, req.body.project);
          return getProjectPlan(project, null);
        }
        catch (err) {
          debug.getPlan(err || 'Project not found.');
          return {error: err || 'Project not found.'};
        }
      }

      // Allow admins to set plan on deployed env.
      if (!config.formio.hosted && req.body.plan && req.isAdmin) {
        return req.body.plan;
      }

      // Allow admin with x-admin-token to set plan on hosted env.
      if (config.formio.hosted && req.body.plan && isSuperAdmin(req)) {
        return req.body.plan;
      }
    }

    if (req.method === 'PUT' && req.projectId && !req.formId) {
      if (config.formio.hosted && req.body.plan && isSuperAdmin(req)) {
        return req.body.plan;
      }
    }

    // Ignore project plans, if not interacting with a project.
    if (!req.projectId) {
      debug.getPlan('No project given.');
      return getBasePlan();
    }
    try {
      const currentProject = await formioServer.formio.cache.loadCurrentProject(req);
      const project = await formioServer.formio.cache.loadPrimaryProject(req);
      if (!currentProject || !project) {
        throw new Error('Project not found.');
      }
      return getProjectPlan(project, currentProject);
    }
    catch (err) {
      debug.getPlan(err || 'Project not found.');
      return {error: err || 'Project not found.'};
    }
  };

  const checkRequest = function(req) {
    return async function() {
      // Don't limit for on premise.
      if (!config.formio.hosted) {
        return;
      }

        const planData = await getPlan(req);
        const {plan, project} = planData;
        let {currentProject} = planData;
        currentProject = currentProject || project;
        const planLimits = ALL_PLAN_LIMITS.hasOwnProperty(plan) ? ALL_PLAN_LIMITS[plan] : ALL_PLAN_LIMITS.basic;
        if (!project) {
          if (!req.body.template) {
            return;
          }

          const forms = {
            ..._.get(req, 'body.template.forms', {}),
            ..._.get(req, 'body.template.resources', {}),
          };

          if (Object.keys(forms).length > planLimits['forms'] && config.enableRestrictions) {
            throw new Error('Limit exceeded. Upgrade your plan.');
          }

          return;
        }

        // Ignore limits for the formio project.
        if (currentProject.hasOwnProperty('name') && project.name && project.name === 'formio') {
          return;
        }

          // Check the calls made this month.
          const usageMetrics = await formioServer.usageTracking.getUsageMetrics(currentProject._id);
          if (usageMetrics === undefined) {
            return;
          }

          // Determine if we've exceeded our counts
          const path = url.parse(req.url).pathname;
          const form = /\/project\/[a-f0-9]{24}\/form$/;
          const formRequests = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}$/;
          const submissionRequests = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission(\/[a-f0-9]{24})?$/;
          const importRequest = /\/project\/[a-f0-9]{24}\/import$/;
          let type;
          if (submissionRequests.test(path)) {
            type = 'submissionRequests';
          }
          else if (formRequests.test(path) && req.method !== 'DELETE') {
            type = 'formRequests';
          }
          // Don't allow modifying forms if over the form limit
          else if (formRequests.test(path) && req.method === 'PUT') {
            type = 'forms';
          }
          // Don't allow creating new forms if over limit.
          else if (form.test(path) && req.method === 'POST') {
            type = 'forms';
          }
          else if (importRequest.test(path) && req.method === 'POST') {
            type = 'import';
          }

          if (type && planLimits[type] && usageMetrics[type] >= planLimits[type] && config.enableRestrictions) {
            // Form modifications should always fail.
            if (type === 'forms') {
              throw new Error('Limit exceeded. Upgrade your plan.');
            }
            else if (planLimits.failure > 0) {
              // Delay the request if over the limit.
              setTimeout(()=>{
                return;
                }, planLimits.failure * 1000);
            }
            else {
              // If not a timed failure, fail straight out.
              throw new Error('Limit exceeded. Upgrade your plan.');
            }
          }
          else if (type === 'import' && config.enableRestrictions) {
            const countOfNewForms = await formioServer.usageTracking.getCountOfNewForms(currentProject._id, {
              ..._.get(req, 'body.template.forms', {}),
              ..._.get(req, 'body.template.resources', {})
            });
            if (usageMetrics['forms'] + countOfNewForms > planLimits['forms']) {
              throw new Error('Limit exceeded. Upgrade your plan.');
            }
            else {
              return;
            }
          }
          else {
            return;
          }
    };
  };

  /**
   * Returns an array of all the plan types
   */
  const getPlans = function() {
    return PLAN_NAMES;
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
    return async function(req, res, next) {
      try {
        const {plan} = await getPlan(req);
        if (plans.indexOf(plan) === -1) {
          debug.allowForPlans(`${plan} not found in whitelist: ${plans.join(', ')}`);
          return res.sendStatus(402);
        }

        return next();
      }
      catch (err) {
        debug.allowForPlans(err);
        return res.sendStatus(402);
      }
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
    checkRequest,
    getPlan,
    getPlans,
    limits: ALL_PLAN_LIMITS,
    allowForPlans,
    disableForPlans
  };
};
