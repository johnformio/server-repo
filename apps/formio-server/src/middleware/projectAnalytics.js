'use strict';

var _ = require('lodash');
var Q = require('q');
var moment = require('moment');
var debug = require('debug')('formio:middleware:projectAnalytics');

module.exports = function(formioServer) {
  /**
   * Get api call info for a project
   * @param project
   * @return [info, project]
   */
  var getCallInfo = function(project) {
    if (!project) {
      return Q.reject('No project');
    }
    if (!project._id) {
      return Q.reject('Project has no ID.');
    }

    project._id = project._id.toString();
    var curr = new Date();
    return Q.nfcall(formioServer.analytics.getCalls, curr.getUTCFullYear(), curr.getUTCMonth(), null, project._id)
    .then(function(used) {
      var limit = formioServer.formio.plans.limits[project.plan];
      var info = {
        used: used,
        remaining: project.plan === 'commercial' ? null : limit - used,
        limit: project.plan === 'commercial' ? null : limit,
        reset: moment().startOf('month').add(1, 'month').toISOString()
      };
      debug('API Call Info:', info);
      return info;
    });
  };

  return function(req, res, next) {
    if (req.method === 'DELETE') {
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
