'use strict';

const _ = require('lodash');
const url = require('url');

const debug = {
  plans: require('debug')('formio:plans'),
  checkRequest: require('debug')('formio:plans:checkRequest'),
  getPlan: require('debug')('formio:plans:getPlan'),
  allowForPlans: require('debug')('formio:plans:allowForPlans'),
  disableForPlans: require('debug')('formio:plans:disableForPlans')
};

module.exports = function(formioServer) {
  const limits = {
    basic: {
      forms: 10,
      formRequests: 1000,
      submissionRequests: 1000,
      emails: 100,
      failure: -1
    },
    independent: {
      forms: 25,
      formRequests: 10000,
      submissionRequests: 10000,
      emails: 1000,
      failure: 5
    },
    team: {
      forms: 50,
      submissionRequests: 250000,
      failure: 2
    },
    trial: {
      forms: 10,
      formRequests: 10000,
      submissionRequests: 10000,
      emails: 100,
      failure: 2
    },
    commercial: {
      submissionRequests: 2000000,
      failure: 1
    }
  };

  const basePlan = formioServer.config.plan || 'commercial';
  debug.plans(`Base Plan: ${basePlan}`);

  /**
   * After loading, determine the plan from the project
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

        // Ignore limits for the formio project.
        if (project.hasOwnProperty('name') && project.name && project.name === 'formio') {
          return cb();
        }

        const curr = new Date();
        const _plan = limits[plan];

        // Get a count of the forms.
        formioServer.formio.resources.form.model.count({
          project: project._id,
          deleted: {$eq: null}
        }, (err, forms) => {
          // Check the calls made this month.
          const year = curr.getUTCFullYear();
          const month = curr.getUTCMonth();

          formioServer.analytics.getCalls(year, month, null, project._id, function(err, calls) {
            if (err || (calls === undefined)) {
              return cb();
            }

            const exceeds = (calls >= _plan.submissionRequests);
            const lastChecked = _.get(project, 'billing.checked', 0);
            const currentCalls = _.get(project, 'billing.calls', 0);
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

            if (type && _plan[type] && calls[type] >= _plan[type]) {
              // Form modifications should always fail.
              if (type === 'forms') {
                // eslint-disable-next-line callback-return
                cb('Limit exceeded. Upgrade your plan.');
              }
              else if (_plan.failure > 0) {
                // Delay the request if over the limit.
                setTimeout(cb, _plan.failure * 1000);
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

            // If the project has no calls, then we can check every minute, otherwise update every hour.
            if ((!currentCalls && ((now - lastChecked) > 60)) || ((now - lastChecked) > 3600) || calls.forms !== project.billing.forms) {
              _.set(project, 'billing.calls', calls.submissionRequests);
              _.set(project, 'billing.usage', calls);
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
