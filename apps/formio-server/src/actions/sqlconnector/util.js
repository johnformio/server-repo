'use strict';

var _ = require('lodash');
var Q = require('q');
var debug = {
  generateQueries: require('debug')('formio:sqlconnector:generateQueries'),
  getConnectorActions: require('debug')('formio:sqlconnector:getConnectorActions'),
  verifyPlan: require('debug')('formio:sqlconnector:verifyPlan')
};

module.exports = function(router) {
  var formio = router.formio;
  var cache = require('../../cache/cache')(formio);
  var required = formio.plans.limits.team;
  var util = formio.util;

  /**
   * Verifies that the current request has the applicable project plan to proceed.
   *
   * @param req
   * @returns {*}
   */
  var verifyPlan = function(req) {
    // Get the plan
    return Q.nfcall(formio.plans.getPlan, req)
      .then(function(plan) {
        // Check that this plan is acceptable for the sql connector.

        if (plan < required) {
          debug.verifyPlan('The given plan is not high enough for sql connector access.. ' + plan + ' / ' + required);
          throw new Error('The current project must be upgraded to access the SQL Connector');
        }

        debug.verifyPlan('Project plan is good!');
        return Q();
      })
      .catch(function(err) {
        throw err;
      });
  };

  /**
   * Util function to get all the actions in the project, associated with the SQL Connector.
   *
   * @param req
   * @returns {*}
   */
  var getConnectorActions = function(req) {
    return Q.ninvoke(cache, 'loadCurrentProject', req)
      .then(function(project) {
        var projectId = util.idToBson(project._id);

        // Get all the forms for the current project, which havent been deleted.
        return Q.ninvoke(router.formio.resources.form.model, 'find', {project: projectId, deleted: {$eq: null}});
      })
      .then(function(forms) {
        var formIds = _.pluck(forms, '_id');
        formIds.map(util.idToBson);

        // Get all the actions for the current projects forms, which havent been deleted.
        return Q.ninvoke(router.formio.actions.model, 'find', {form: {$in: formIds}, deleted: {$eq: null}});
      })
      .then(function(actions) {
        // Get all the sql connector actions
        var sqlActions = _.filter(actions, function(item) {
          return item.name === 'sqlconnector';
        });
        debug.getConnectorActions(sqlActions);

        return Q(sqlActions);
      })
      .catch(function(err) {
        debug.getConnectorActions(err);
        throw err;
      });
  };

  /**
   * Middleware Route to generate the SQL queries for the SQL Connector application.
   *
   * @param req
   * @param res
   * @param next
   */
  var generateQueries = function(req, res, next) {
    return Q.fcall(verifyPlan, req)
      .then(function() {
        return Q.fcall(getConnectorActions, req)
      })
      .then(function(actions) {
        return res.status(200).json(actions);
      })
      .catch(function(err) {
        debug.generateQueries(err);
        return res.sendStatus(400);
      })
      .done();
  };

  return {
    generateQueries: generateQueries
  };
};
