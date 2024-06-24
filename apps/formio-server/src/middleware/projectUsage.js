'use strict';

const _ = require('lodash');
const config = require('../../config');

module.exports = function(formioServer) {
  const loadPrimaryProjectPlanFromCache = async (req, primaryProjectId) => {
    const primaryProject = await formioServer.formio.cache.loadProject(req, primaryProjectId);
    if (!primaryProject) {
      throw new Error('Primary project not found');
    }
    else {
      return primaryProject.plan;
    }
  };

  /**
   * Get api call info for a project
   * @param project
   * @return [info, project]
   */
  const getCallInfo = async function(project, plan) {
    if (!project || !project._id) {
      return null;
    }

    const projectId = project._id.toString();
    const usageMetrics = await formioServer.usageTracking.getUsageMetrics(projectId);
    const limit = _.cloneDeep(formioServer.formio.plans.limits[plan || formioServer.config.plan]);
    delete limit.failure;
    return {
      used: usageMetrics,
      limit: limit,
    };
  };

  return async function(req, res, next) {
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
    try {
      for (const project of [].concat(res.resource.item)) {
        if (!project.project) {
          project.apiCalls = await getCallInfo(project, project.plan);
        }
        else {
          // Stages should load the primary project and base plan limits off of primary project plan.
          const primaryProjectPlan = await loadPrimaryProjectPlanFromCache(req, project.project);
          project.apiCalls = await getCallInfo(project, primaryProjectPlan);
        }
      }
      return next();
    }
    catch (err) {
      return next(err);
    }
  };
};
