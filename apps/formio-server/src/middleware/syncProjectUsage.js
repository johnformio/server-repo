'use strict';

const moment = require('moment');
const _ = require('lodash');

const config = require('../../config');

/**
 * This middleware ensures backwards compatibility with the legacy `billing` object in hosted environments
 * by syncing the billing object in the project cache per request and periodically syncing the db
 * @param formioServer
 */
module.exports = (formioServer) => {
  return async function(req, res, next) {
    if (!config.formio.hosted || !req.projectId) {
      return next();
    }
    try {
      const projectId = req.projectId;
      const projectCache = formioServer.formio.cache;
      const project = await projectCache.loadProject(req, projectId);
      const usageMetrics = await formioServer.usageTracking.getUsageMetrics(
        projectId
      );

      const lastChecked = moment.utc(_.get(project, 'billing.checked', 0));
      const now = moment.utc();

      if (now.isAfter(lastChecked.add(10, 'minute'))) {
        const updatedBilling = {
          ...project.billing,
          calls: usageMetrics.submissionRequests,
          usage: usageMetrics,
          checked: now,
        };
        const updatedProject = {
          ...project,
          billing: updatedBilling,
        };
        projectCache.updateProjectCache(updatedProject);
        projectCache.updateProject(updatedProject._id, {billing: updatedBilling});
      }
      else {
        const updatedBilling = {
          ...project.billing,
          calls: usageMetrics.calls,
          usage: usageMetrics,
        };
        const updatedProject = {
          ...project,
          billing: updatedBilling,
        };
        projectCache.updateProjectCache(updatedProject);
      }
      return next();
    }
    catch (err) {
      return next(err);
    }
  };
};
