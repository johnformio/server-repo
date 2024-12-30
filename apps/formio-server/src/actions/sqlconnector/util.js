'use strict';
// For: SQLConnector 0.1.0
// Maintenance mode
const _ = require('lodash');
const Q = require('q');
const debug = {
  action: require('debug')('formio:action:sqlconnector'),
  generateQueries: require('debug')('formio:sqlconnector:generateQueries'),
  getConnectorActions: require('debug')('formio:sqlconnector:getConnectorActions'),
  actionsToRoutes: require('debug')('formio:sqlconnector:actionsToRoutes'),
  getExpressRoute: require('debug')('formio:sqlconnector:getExpressRoute'),
  verifyPlan: require('debug')('formio:sqlconnector:verifyPlan')
};
const knex = require('knex');

const primaryComparison = '{{ params.id }}';

module.exports = (router) => {
  const formio = router.formio;
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
  function verifyPlan(req) {
    // Get the plan
    return Q.nfcall(formio.plans.getPlan, req)
      .then((plan) => {
        // Get the plan and ignore the project response.
        plan = plan[0];

        // Check that this plan is acceptable for the sql connector.
        if (!['trial', 'team', 'commercial'].includes(plan)) {
          debug.verifyPlan(`The given plan is not high enough for sql connector access.. ${plan}`);
          throw new Error('The current project must be upgraded to access the SQL Connector');
        }

        debug.verifyPlan('Project plan is good!');
        return Q();
      })
      .catch((err) => {
        throw err;
      });
  }

  function getExpressRoute(method, path, primary, data, type) {
    debug.getExpressRoute('type:');
    debug.getExpressRoute(type);

    function isPostgresql() {
      return type === 'postgres';
    }

    // Only let valid types through.
    const valid = ['mssql', 'mysql', 'postgres'];
    if (!valid.includes(type)) {
      type = 'mysql';
    }

    const defaultSettings = {
      client: type
    };

    // Make an instanced type of knex.
    const _knex = knex(defaultSettings);

    method = method.toString().toLowerCase();
    const route = {
      endpoint: `/${path}`
    };

    let _knx;
    switch (method) {
      case 'create':
        try {
          route.method = 'POST';

          const pairs = {};
          for (const [column, value] of Object.entries(data)) {
            pairs[column] = `{{ data.${value} }}`;
          }

          if (isPostgresql()) {
            route.query = _knex(path.toString())
            .insert(pairs)
            .returning('*')
            .toString();
          }
          else {
            // Get the primary insert string.
            route.query = _knex(path.toString())
            .insert(pairs)
            .toString();

            _knx = _knex(path.toString())
            .select()
            .whereRaw(`id = ${idFn[type]}`)
            .toString();

            // Get the select string for the new record.
            route.query += `; ${ _knx}`;
          }
        }
        catch (err) {
          debug.action(err);
          throw (err);
        }

        break;
      case 'index':
        try {
          route.method = 'GET';
          route.query = _knex(path.toString())
          .toString();
        }
        catch (err) {
          debug.action(err);
          throw (err);
        }
        break;
      case 'read':
        try {
          route.method = 'GET';
          route.endpoint += '/:id';
          route.query = _knex(path.toString())
            .where(primary , primaryComparison)
            .toString();
      }
      catch (err) {
        debug.action(err);
        throw (err);
      }
        break;
      case 'update':
        try {
          route.method = 'PUT';
          route.endpoint += '/:id';

          const pairs = {};
          for (const [column, value] of Object.entries(data)) {
            pairs[column] = `{{ data.${value} }}`;
          }

          if (isPostgresql()) {
            route.query = _knex(path.toString())
            .where(primary, primaryComparison)
            .update(pairs)
            .returning('*')
            .toString();
          }
          else {
            // Get the primary insert string.
            route.query = _knex(path.toString())
              .where(primary, primaryComparison)
              .update(pairs)
              .toString();

            _knx = _knex(path.toString())
              .where(primary, primaryComparison)
              .toString();

            // Get the select string for the updated record.
            route.query += `; ${ _knx}`;
          }
      }
      catch (err) {
        debug.action(err);
        throw (err);
      }
        break;
      case 'delete':
        try {
          route.method = 'DELETE';
          route.endpoint += '/:id';

          route.query = _knex(path.toString())
          .where(primary, primaryComparison)
          .del()
          .toString();
          }
          catch (err) {
            debug.action(err);
            throw (err);
          }
        break;
    }

    return route;
  }

  function actionsToRoutes(req, actions) {
    return Q.ninvoke(formio.cache, 'loadCurrentProject', req)
      .then((project) => {
        if (!project) {
          throw new Error('Project not found');
        }
        debug.actionsToRoutes(project);
        const type = _.get(project, 'settings.sqlconnector.type');

        const routes = [];
        let path, primary, fields, data;
        for (const action of actions) {
          // Pluck out the core info from the action.
          path = _.get(action, 'settings.table');
          primary = _.get(action, 'settings.primary') || 'id';
          data = {};

          // Iterate over each field to get the data mapping.
          fields = _.get(action, 'settings.fields');
          for (const field of fields) {
            data[field.column] = _.get(field, 'field.key');
          }

          for (const method of ['create', 'read', 'index', 'update', 'delete']) {
            routes.push(getExpressRoute(method, path, primary, data, type));
          }
        }

        return routes;
      })
      .catch((err) => {
        debug.actionsToRoutes(err);
        throw err;
      });
  }

  /**
   * Util function to get all the actions in the project, associated with the SQL Connector.
   *
   * @param req
   * @returns {*}
   */
  function getConnectorActions(req) {
    return Q.ninvoke(formio.cache, 'loadCurrentProject', req)
      .then((project) => {
        if (!project) {
          throw new Error('Project not found');
        }
        const projectId = util.idToBson(project._id);
        return router.formio.resources.form.model.find({project: projectId, deleted: {$eq: null}}).lean().exec();
      })
      .then((forms) => {
        const formIds = _.map(forms, (form) => util.idToBson(form._id));
        return router.formio.actions.model.find({
          form: {$in: formIds},
          deleted: {$eq: null},
          name: 'sqlconnector'
        }).lean().exec();
      })
      .catch((err) => {
        debug.getConnectorActions(err);
        throw err;
      });
  }

  /**
   * Middleware Route to generate the SQL queries for the SQL Connector application.
   *
   * @param req
   * @param res
   * @param next
   */
  function generateQueries(req, res, next) {
    return Q.fcall(verifyPlan, req)
      .then(() => Q.fcall(getConnectorActions, req))
      .then((actions) => Q.fcall(actionsToRoutes, req, actions))
      .then((routes) => res.status(200).json(routes))
      .catch((err) => {
        debug.generateQueries(err);
        if (err.message === 'The current project must be upgraded to access the SQL Connector') {
          return res.status(402).send('The current project must be upgraded to access the SQL Connector');
        }

        return res.sendStatus(400);
      })
      .done();
  }

  return {
    generateQueries
  };
};
