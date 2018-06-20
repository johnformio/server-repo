'use strict';

const _ = require('lodash');
const Q = require('q');
const debug = {
  generateQueries: require('debug')('formio:sqlconnector:generateQueries'),
  getConnectorActions: require('debug')('formio:sqlconnector:getConnectorActions'),
  actionsToRoutes: require('debug')('formio:sqlconnector:actionsToRoutes'),
  getExpressRoute: require('debug')('formio:sqlconnector:getExpressRoute'),
  verifyPlan: require('debug')('formio:sqlconnector:verifyPlan')
};
const squel = require('squel');

module.exports = function(router) {
  const formio = router.formio;
  const required = formio.plans.limits.team;
  const util = formio.util;

  // Building blocks for sql statements.
  const idFn = {
    mysql: 'LAST_INSERT_ID()',
    mssql: 'SCOPE_IDENTITY()'
  };

  /**
   * Verifies that the current request has the applicable project plan to proceed.
   *
   * @param req
   * @returns {*}
   */
  const verifyPlan = function(req) {
    // Get the plan
    return Q.nfcall(formio.plans.getPlan, req)
      .then(function(plan) {
        // Get the plan and ignore the project response.
        plan = plan[0];
        plan = _.get(formio.plans.limits, plan);

        // Check that this plan is acceptable for the sql connector.
        if (plan < required) {
          debug.verifyPlan(`The given plan is not high enough for sql connector access.. ${plan} / ${required}`);
          throw new Error('The current project must be upgraded to access the SQL Connector');
        }

        debug.verifyPlan('Project plan is good!');
        return Q();
      })
      .catch(function(err) {
        throw err;
      });
  };

  const getExpressRoute = function(method, path, primary, data, type) {
    debug.getExpressRoute('type:');
    debug.getExpressRoute(type);
    const isMssql = function() { // eslint-disable-line no-unused-vars
      return type === 'mssql';
    };
    const isMysql = function() { // eslint-disable-line no-unused-vars
      return type === 'mysql';
    };
    const isPostgresql = function() {
      return type === 'postgres';
    };

    // Only let valid types through.
    const valid = ['mssql', 'mysql', 'postgres'];
    if (valid.indexOf(type) === -1) {
      type = 'mysql';
    }

    // Make an instanced type of squel.
    const _squel = squel.useFlavour(type);

    method = method.toString().toLowerCase();
    const route = {
      endpoint: `/${path.toString()}`
    };

    /**
     * Util function to generate the primary key comparison for different sql types.
     *
     * @returns {*}
     */
    const getPrimaryComparison = function() {
      let comparison;
      if (isPostgresql()) {
        comparison = ' = text(\'{{ params.id }}\')';
      }
      else {
        comparison = ' = {{ params.id }}';
      }

      return comparison;
    };

    let _sql;
    switch (method) {
      case 'create':
        route.method = 'POST';
        _sql = _squel
          .insert()
          .into(path.toString());

        debug.getExpressRoute('data:');
        debug.getExpressRoute(data);
        _.each(data, function(value, column) {
          if (isPostgresql()) {
            column = `"${column}"`;
          }

          _sql.set(column, `{{ data.${value} }}`);
        });

        if (isPostgresql()) {
          _sql.returning('*');
          route.query = _sql.toString();
        }
        else {
          // Get the primary insert string.
          route.query = _sql.toString();

          _sql = _squel
            .select()
            .from(path.toString())
            .where(`${primary.toString()}=${_.get(idFn, type)}`)
            .toString();

          // Get the select string for the new record.
          route.query += `; ${ _sql.toString()}`;
        }

        break;
      case 'index':
        route.method = 'GET';
        _sql = _squel
          .select()
          .from(path.toString());

        route.query = _sql.toString();
        break;
      case 'read':
        route.method = 'GET';
        route.endpoint += '/:id';
        _sql = _squel
          .select()
          .from(path.toString())
          .where(primary.toString() + (getPrimaryComparison()).toString());

        route.query = _sql.toString();
        break;
      case 'update':
        route.method = 'PUT';
        route.endpoint += '/:id';
        _sql = _squel
          .update()
          .table(path.toString());

        debug.getExpressRoute('data:');
        debug.getExpressRoute(data);
        _.each(data, function(value, column) {
          if (isPostgresql()) {
            column = `"${column}"`;
          }

          _sql.set(column, `{{ data.${value} }}`);
        });

        _sql.where(primary.toString() + (getPrimaryComparison()).toString());

        if (isPostgresql()) {
          _sql.returning('*');
          route.query = _sql.toString();
        }
        else {
          // Get the primary insert string.
          route.query = _sql.toString();

          _sql = _squel
            .select()
            .from(path.toString())
            .where(primary.toString() + (getPrimaryComparison()).toString())
            .toString();

          // Get the select string for the updated record.
          route.query += `; ${ _sql.toString()}`;
        }

        break;
      case 'delete':
        route.method = 'DELETE';
        route.endpoint += '/:id';
        _sql = _squel
          .delete()
          .from(path.toString())
          .where(primary.toString() + (getPrimaryComparison()).toString());

        route.query = _sql.toString();
        break;
    }

    return route;
  };

  const actionsToRoutes = function(req, actions) {
    return Q.ninvoke(formio.cache, 'loadCurrentProject', req)
      .then(function(project) {
        debug.actionsToRoutes(project);
        const type = _.get(project, 'settings.sqlconnector.type');

        const routes = [];
        let path, primary, fields, data;
        _.each(actions, function(action) {
          // Pluck out the core info from the action.
          path = _.get(action, 'settings.table');
          primary = _.get(action, 'settings.primary') || 'id';
          data = {};

          // Iterate over each field to get the data mapping.
          fields = _.get(action, 'settings.fields');
          _.each(fields, function(field) {
            data[field.column] = _.get(field, 'field.key');
          });

          _.each(['create', 'read', 'index', 'update', 'delete'], function(method) {
            routes.push(getExpressRoute(method, path, primary, data, type));
          });
        });

        return routes;
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
  const getConnectorActions = function(req) {
    return Q.ninvoke(formio.cache, 'loadCurrentProject', req)
      .then(function(project) {
        const projectId = util.idToBson(project._id);

        // Get all the forms for the current project, which havent been deleted.
        return Q.ninvoke(router.formio.resources.form.model, 'find', {project: projectId, deleted: {$eq: null}});
      })
      .then(function(forms) {
        const formIds = _(forms)
        .map(function(form) {
          return util.idToBson(form._id);
        })
        .value();

        // Get all the actions for the current projects forms, which havent been deleted.
        return Q.ninvoke(
          router.formio.actions.model,
          'find',
          {form: {$in: formIds}, deleted: {$eq: null}, name: 'sqlconnector'}
        );
      })
      .then(function(actions) {
        // Get all the sql connector actions
        const sqlActions = _(actions)
        .map(function(action) {
          try {
            return action.toObject();
          }
          catch (e) {
            return action;
          }
        })
        .value();

        debug.getConnectorActions(sqlActions);
        return sqlActions;
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
  const generateQueries = function(req, res, next) {
    return Q.fcall(verifyPlan, req)
      .then(function() {
        return Q.fcall(getConnectorActions, req);
      })
      .then(function(actions) {
        return Q.fcall(actionsToRoutes, req, actions);
      })
      .then(function(routes) {
        return res.status(200).json(routes);
      })
      .catch(function(err) {
        debug.generateQueries(err);
        if (err.message === 'The current project must be upgraded to access the SQL Connector') {
          return res.status(402).send('The current project must be upgraded to access the SQL Connector');
        }

        return res.sendStatus(400);
      })
      .done();
  };

  return {
    generateQueries
  };
};
