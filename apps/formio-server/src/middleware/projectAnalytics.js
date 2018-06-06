'use strict';

const _ = require('lodash');
const moment = require('moment');

module.exports = function(formioServer) {
  /**
   * Get api call info for a project
   * @param project
   * @return [info, project]
   */
  const getCallInfo = function(project) {
    if (!project) {
      return null;
    }
    if (!project._id) {
      return null;
    }

    project._id = project._id.toString();
    const used = _.get(project, 'billing.calls', 0);
    const limit = formioServer.formio.plans.limits[project.plan];
    return {
      used: used,
      remaining: limit - used,
      limit: limit,
      reset: moment().startOf('month').add(1, 'month').toISOString()
    };
  };

  return function(req, res, next) {
    if (req.method === 'DELETE') {
      return next();
    }

    // This happens when an error occurred. Don't count it.
    if (!res.resource.item) {
      return next();
    }

    next(null, _.map([].concat(res.resource.item), function(project) {
      project.apiCalls = getCallInfo(project);
      return project;
    }));
  };
};
