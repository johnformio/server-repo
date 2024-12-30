'use strict';
// For: SQLConnector 1.0.0+
const _ = require('lodash');
const Q = require('q');
const debug = {
  action: require('debug')('formio:action:sqlconnector'),
  generateQueries: require('debug')('formio:sqlconnector2:generateQueries'),
  getConnectorActions: require('debug')('formio:sqlconnector2:getConnectorActions'),
  actionsToRoutes: require('debug')('formio:sqlconnector2:actionsToRoutes'),
  getExpressRoute: require('debug')('formio:sqlconnector2:getExpressRoute'),
  verifyPlan: require('debug')('formio:sqlconnector2:verifyPlan')
};
const knex = require('knex');

const primaryComparison = 'params.id';

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

  // FIXME: This function should be broken up
  function getExpressRoute(method, path, primary, data, type) {
    debug.getExpressRoute('type:');
    debug.getExpressRoute(type);

    function isMysql() {
      return type === 'mysql';
    }
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
      endpoint: `/${path}`,
      db: 'default'
    };

    let _knx, param;
    switch (method) {
      case 'create':
        try {
          route.method = 'POST';

          const pairs = {};
          for (const [column, value] of Object.entries(data)) {
            pairs[column] = `body.data.${value}`;
          }

          if (isPostgresql()) {
          param = _knex(path.toString())
          .insert(pairs)
          .returning('*')
          .toSQL();

            route.query = [
              [
                param.sql,
                ...param.bindings
              ]
            ];
          }
          else {
            _knx = _knex(path.toString())
            .insert(pairs)
            .toSQL();

            // Get the primary insert string.
            param = _knx.toNative();

            // Convert query back to non-native version, the native version will broke after when tries to replace bindings
            // Related to: https://github.com/knex/knex/issues/3997
            param.sql = _knx.sql;

            _knx = _knex(path.toString())
              .select()
              .table(path.toString())
              .whereRaw(`${primary} = ${idFn[type]}`)
              .toString();

              if ( isMysql() ) {
                route.query = [
                  [
                    param.sql,
                    ...param.bindings
                  ],
                  [
                    _knx
                  ]
                ];
              }
              else {
                route.query = [
                  [
                    `${param.sql}; ${_knx}`,
                    ...param.bindings
                  ]
                ];
              }

            // Get the select string for the new record.
            route.query;
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
          param = _knex(path.toString())
          .toSQL();
          route.query = [
            [
              param.sql,
              ...param.bindings
            ]
          ];
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

          param = _knex(path.toString())
            .where(primary , primaryComparison)
            .toSQL();

            route.query = [
              [
                param.sql,
                ...param.bindings
              ]
            ];
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
            pairs[column] = `body.data.${value}`;
          }

          if (isPostgresql()) {
            param = _knex(path.toString())
            .where(primary, primaryComparison)
            .update(pairs)
            .returning('*')
            .toSQL();

            route.query = [
              [
                param.sql,
                ...param.bindings
              ]
            ];
          }
          else {
            // Get the primary insert string.
            param = _knex(path.toString())
            .where(primary, primaryComparison)
            .update(pairs)
            .toSQL();

            route.query = [
              [
                param.sql,
                ...param.bindings
              ]
            ];

            param = _knex(path.toString())
            .where(primary, primaryComparison)
            .toSQL();

            route.query.push([
              param.sql,
              ...param.bindings
            ]);
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
          param = _knex(path.toString())
            .where(primary, primaryComparison)
            .del()
            .toSQL();

            route.query = [
              [
                param.sql,
                ...param.bindings
              ]
            ];
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
