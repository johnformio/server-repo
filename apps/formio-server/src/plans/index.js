'use strict';

const config = require('../../config.js');
const _ = require('lodash');
const url = require('url');
const plans = {
  basic: {
    forms: 10,
    formRequests: 1000,
    submissionRequests: 1000,
    emails: 0,
    pdfDownloads: 10,
    pdfs: 1,
    failure: -1
  },
  independent: {
    forms: 25,
    formRequests: 10000,
    submissionRequests: 10000,
    emails: 0,
    failure: 5,
    pdfDownloads: 10,
    pdfs: 1,
  },
  team: {
    forms: 50,
    submissionRequests: 250000,
    formRequests: 250000,
    pdfDownloads: 10,
    emails: 0,
    pdfs: 1,
    failure: 2
  },
  trial: {
    forms: 10,
    formRequests: 10000,
    submissionRequests: 10000,
    emails: 0,
    failure: 2
  },
  commercial: {
    submissionRequests: 2000000,
    pdfDownloads: 1000,
    emails: 1000,
    pdfs: 25,
    failure: 1
  }
};
const planNames = Object.keys(plans);

const debug = {
  plans: require('debug')('formio:plans'),
  getPlan: require('debug')('formio:plans:getPlan'),
  allowForPlans: require('debug')('formio:plans:allowForPlans'),
  disableForPlans: require('debug')('formio:plans:disableForPlans'),
  checkRequest: require('debug')('formio:plans:checkRequest')
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

  const checkRequest = function(req) {
    return function(cb) {
      // Don't limit for on premise.
      if (!config.formio.hosted) {
        return cb();
      }

      getPlan(req, function(err, plan, project, currentProject) {
        currentProject = currentProject || project;
        // Ignore project plans, if not interacting with a project.
        if (!err && !project) {
          return cb();
        }

        if (err) {
          return cb(err);
        }

        // Ignore limits for the formio project.
        if (currentProject.hasOwnProperty('name') && project.name && project.name === 'formio') {
          return cb();
        }

        const curr = new Date();
        const limits = plans.hasOwnProperty(plan) ? plans[plan] : plans.basic;

        // Get a count of the forms.
        formioServer.formio.resources.form.model.countDocuments({
          project: req.projectId,
          deleted: {$eq: null}
        }, (err, forms) => {
          // Check the calls made this month.
          const year = curr.getUTCFullYear();
          const month = curr.getUTCMonth();

          formioServer.analytics.getCalls(year, month, null, currentProject._id, function(err, calls) {
            if (err || (calls === undefined)) {
              return cb();
            }

            const exceeds = (calls >= limits.submissionRequests);
            const lastChecked = _.get(currentProject, 'billing.checked', 0);
            const currentCalls = _.get(currentProject, 'billing.calls', 0);
            const now = Math.floor(Date.now() / 1000);
            calls.forms = forms;

            // Determine if we've exceeded our counts
            const path = url.parse(req.url).pathname;
            const form = /\/project\/[a-f0-9]{24}\/form$/;
            const formRequests = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}$/;
            const submissionRequests = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission(\/[a-f0-9]{24})?$/;
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

            if (type && limits[type] && calls[type] >= limits[type] && process.env.ENABLE_RESTRICTIONS) {
              // Form modifications should always fail.
              if (type === 'forms') {
                // eslint-disable-next-line callback-return
                cb('Limit exceeded. Upgrade your plan.');
              }
              else if (limits.failure > 0) {
                // Delay the request if over the limit.
                setTimeout(cb, limits.failure * 1000);
              }
              else {
                // If not a timed failure, fail straight out.
                // eslint-disable-next-line callback-return
                cb('Limit exceeded. Upgrade your plan.');
              }
            }
            else {
              // eslint-disable-next-line callback-return
              cb();
            }

            // If the project has no calls, then we can check every minute, otherwise update every 5 minutes.
            if ((!currentCalls && ((now - lastChecked) > 60)) || ((now - lastChecked) > 300) || calls.forms !== project.billing.forms) {
              _.set(currentProject, 'billing.calls', calls.submissionRequests);
              _.set(currentProject, 'billing.usage', calls);
              _.set(currentProject, 'billing.exceeds', exceeds);
              _.set(currentProject, 'billing.checked', now);
              formioServer.formio.resources.project.model.updateOne({
                _id: formioServer.formio.mongoose.Types.ObjectId(currentProject._id.toString())
              }, {$set: {'billing': currentProject.billing}}, (err, result) => {
                debug.checkRequest('Updated project billing.');
              });
            }
          });
        });
      });
    };
  };

  /**
   * Returns an array of all the plan types
   */
  const getPlans = function() {
    return planNames;
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
    checkRequest,
    getPlan: getPlan,
    getPlans: getPlans,
    limits: plans,
    allowForPlans: allowForPlans,
    disableForPlans: disableForPlans
  };
};
