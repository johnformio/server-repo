'use strict';

const _ = require('lodash');
const moment = require('moment');
const config = require('../../config');

module.exports = function(formioServer) {
  /**
   * Get api call info for a project
   * @param project
   * @return [info, project]
   */
  const getCallInfo = function(project, plan) {
    if (!project || !project._id) {
      return null;
    }

    project._id = project._id.toString();
    const used = _.get(project, 'billing.usage', {});
    used.forms = used.forms || 0;
    used.emails = used.emails || 0;
    used.formRequests = used.formRequests || 0;
    used.submissionRequests = used.submissionRequests || 0;
    const limit = _.cloneDeep(formioServer.formio.plans.limits[plan || formioServer.config.plan]);
    delete limit.failure;
    return {
      used: used,
      limit: limit,
      reset: moment().startOf('month').add(1, 'month').toISOString()
    };
  };

  return function(req, res, next) {
    if (req.method === 'DELETE') {
      return next();
    }

    // Skip for deployed servers.
    if (!config.formio.hosted) {
      return next();
    }

    // This happens when an error occurred. Don't count it.
    if (!res.resource.item) {
      return next();
    }

    const promises = [];
    [].concat(res.resource.item).forEach(project => {
      if (!project.project) {
        project.apiCalls = getCallInfo(project, project.plan);
      }
      else {
        // Stages should load the primary project and base plan limits off of primary project plan.
        promises.push(new Promise((resolve, reject) => {
          formioServer.formio.cache.loadProject(req, project.project, (err, primaryProject) => {
            if (!primaryProject || err) {
              return reject(err || new Error('Primary project not found'));
            }
            project.apiCalls = getCallInfo(project, primaryProject.plan);
            return resolve();
          });
        }));
      }
    });

    Promise.all(promises)
      .then(() => next(null))
      .catch(next);
  };
};
