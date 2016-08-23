'use strict';

var _ = require('lodash');
var Q = require('q');
var debug = {
  generateQueries: require('debug')('formio:sqlconnector:generateQueries'),
  getConnectorActions: require('debug')('formio:sqlconnector:getConnectorActions'),
  actionsToRoutes: require('debug')('formio:sqlconnector:actionsToRoutes'),
  getExpressRoute: require('debug')('formio:sqlconnector:getExpressRoute'),
  verifyPlan: require('debug')('formio:sqlconnector:verifyPlan')
};
var squel = require('squel');

module.exports = function(router) {
  var formio = router.formio;
  var cache = require('../../cache/cache')(formio);
  var required = formio.plans.limits.team;
  var util = formio.util;

  // Building blocks for sql statements.
  var idFn = {
    mysql: 'LAST_INSERT_ID()',
    mssql: 'SCOPE_IDENTITY()'
  };

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

  var getExpressRoute = function(method, path, primary, data, type) {
    method = method.toString().toLowerCase();
    var route = {
      endpoint: '/' + path.toString()
    };

    var _sql;
    switch (method) {
      case 'create':
        route.method = 'POST';
        _sql = squel
          .insert()
          .into(path.toString());

        debug.getExpressRoute('data:');
        debug.getExpressRoute(data);
        _.each(data, function(value, column) {
          _sql.set(column, '{{ data.' + value + ' }}');
        });

        // Get the primary insert string.
        route.query = _sql.toString();

        debug.getExpressRoute('type:');
        debug.getExpressRoute(type);
        _sql = squel
          .select()
          .from(path.toString())
          .where(primary.toString() + '=' + _.get(idFn, type))
          .toString();

        // Get the select string for the new record.
        route.query += '; ' +  _sql.toString();
        break;
      case 'index':
        route.method = 'GET';
        _sql = squel
          .select()
          .from(path.toString());

        route.query = _sql.toString();
        break;
      case 'read':
        route.method = 'GET';
        route.endpoint += '/:id';
        _sql = squel
          .select()
          .from(path.toString())
          .where(primary.toString() + ' = {{ params.id }}');

        route.query = _sql.toString();
        break;
      case 'update':
        route.method = 'PUT';
        route.endpoint += '/:id';
        _sql = squel
          .update()
          .table(path.toString());

        debug.getExpressRoute('data:');
        debug.getExpressRoute(data);
        _.each(data, function(value, column) {
          _sql.set(column, '{{ data.' + value + ' }}');
        });

        _sql.where(primary.toString() + ' = {{ params.id }}');

        // Get the primary insert string.
        route.query = _sql.toString();

        _sql = squel
          .select()
          .from(path.toString())
          .where(primary.toString() + ' = {{ params.id }}')
          .toString();

        // Get the select string for the updated record.
        route.query += '; ' +  _sql.toString();
        break;
      case 'delete':
        route.method = 'DELETE';
        route.endpoint += '/:id';
        _sql = squel
          .delete()
          .from(path.toString())
          .where(primary.toString() + ' = {{ params.id }}');

        route.query = _sql.toString();
        break;
    }

    return route;
  };

  var actionsToRoutes = function(req, actions) {
    return Q.ninvoke(cache, 'loadCurrentProject', req)
      .then(function(project) {
        debug.actionsToRoutes(project);
        var type = _.get(project, 'settings.sqlconnector.type');

        var routes = [];
        var path, primary, methods, fields, data, route;
        _.each(actions, function(action) {
          // Pluck out the core info from the action.
          path = _.get(action, 'settings.table');
          primary = _.get(action, 'settings.primary') || 'id';
          methods = _.get(action, 'method');
          data = {};
          route = {};

          // Iterate over each field to get the data mapping.
          fields = _.get(action, 'settings.fields');
          _.each(fields, function(field) {
            data[field.column] = _.get(field, 'field.key')
          });

          _.each(methods, function(method) {
            routes.push(getExpressRoute(method, path, primary, data, type));
          });
        });

        return Q(routes);
      })
      .catch(function(err) {
        debug.actionsToRoutes(err);
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
        return Q.fcall(actionsToRoutes, req, actions);
      })
      .then(function(routes) {
        return res.status(200).json(routes);
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
