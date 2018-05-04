'use strict';

const _ = require('lodash');
const Q = require('q');
const moment = require('moment');

module.exports = function(formioServer) {
  /**
   * Get api call info for a project
   * @param project
   * @return [info, project]
   */
  const getCallInfo = function(project) {
    if (!project) {
      return Q.reject('No project');
    }
    if (!project._id) {
      return Q.reject('Project has no ID.');
    }

    project._id = project._id.toString();
    const curr = new Date();
    return Q.nfcall(formioServer.analytics.getCalls, curr.getUTCFullYear(), curr.getUTCMonth(), null, project._id)
    .then(used => {
      return Q.nfcall(formioServer.analytics.getEmails, curr.getUTCFullYear(), curr.getUTCMonth() + 1, project._id)
        .then(emails => {
          const limit = formioServer.formio.plans.limits[project.plan];
          const info = {
            used,
            remaining: limit - used,
            limit,
            reset: moment().startOf('month').add(1, 'month').toISOString(),
            emails
          };
          return info;
        });
    });
  };

  return function(req, res, next) {
    if (req.method === 'DELETE') {
      return next();
    }

    // This happens when an error occurred. Don't count it.
    if (!res.resource.item) {
      return next();
    }

    Q.all(_.map([].concat(res.resource.item), function(project) {
      return getCallInfo(project)
      .then(function(info) {
        project.apiCalls = info;
      });
    }))
    .nodeify(next);
  };
};
