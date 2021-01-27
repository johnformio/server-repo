'use strict';
// For: SQLConnector 1.0.0+
const _ = require('lodash');
const Q = require('q');
const debug = {
  generateQueries: require('debug')('formio:sqlconnector2:generateQueries'),
  getConnectorActions: require('debug')('formio:sqlconnector2:getConnectorActions'),
  actionsToRoutes: require('debug')('formio:sqlconnector2:actionsToRoutes'),
  getExpressRoute: require('debug')('formio:sqlconnector2:getExpressRoute'),
  verifyPlan: require('debug')('formio:sqlconnector2:verifyPlan')
};
const squel = require('squel');

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
  // eslint-disable-next-line max-statements
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
      autoQuoteTableNames: true,
      autoQuoteFieldNames: true,
      nameQuoteCharacter: isMysql() ? '`' : '"',
    };

    // Make an instanced type of squel.
    const _squel = squel.useFlavour(type);

    method = method.toString().toLowerCase();
    const route = {
      endpoint: `/${path}`,
      db: 'default'
    };

    let _sql, param;
    switch (method) {
      case 'create':
        route.method = 'POST';
        _sql = _squel
          .insert(defaultSettings)
          .into(path.toString());

        debug.getExpressRoute('data:');
        debug.getExpressRoute(data);

        for (const [column, value] of Object.entries(data)) {
          _sql.set(column, `body.data.${value}`);
        }

        if (isPostgresql()) {
          _sql.returning('*');
          param = _sql.toParam();
          route.query = [
            [
              param.text,
              ...param.values
            ]
          ];
        }
        else {
          // Get the primary insert string.
          param = _sql.toParam();

          _sql = _squel
            .select(defaultSettings)
            .from(path.toString())
            .where(`${primary}=${idFn[type]}`)
            .toString();

            if ( isMysql() ) {
              route.query = [
                [
                  param.text,
                  ...param.values
                ],
                [
                  _sql
                ]
              ];
            }
            else {
              route.query = [
                [
                  `${param.text}; ${_sql}`,
                  ...param.values
                ]
              ];
            }

          // Get the select string for the new record.
          route.query;
        }

        break;
      case 'index':
        route.method = 'GET';
        _sql = _squel
          .select(defaultSettings)
          .from(path.toString());
        param = _sql.toParam();

        route.query = [
          [
            param.text,
            ...param.values
          ]
        ];
        break;
      case 'read':
        route.method = 'GET';
        route.endpoint += '/:id';
        _sql = _squel
          .select(defaultSettings)
          .from(path.toString())
          .where(`${primary} = ?`,primaryComparison);
          param = _sql.toParam();

          route.query = [
            [
              param.text,
              ...param.values
            ]
          ];
        break;
      case 'update':
        route.method = 'PUT';
        route.endpoint += '/:id';
        _sql = _squel
          .update(defaultSettings)
          .table(path.toString());

        debug.getExpressRoute('data:');
        debug.getExpressRoute(data);
        for (const [column, value] of Object.entries(data)) {
          _sql.set(column, `body.data.${value}`);
        }

        _sql.where(`${primary} = ?`,primaryComparison);

        if (isPostgresql()) {
          _sql.returning('*');
          param = _sql.toParam();
          route.query = [
            [
              param.text,
              ...param.values
            ]
          ];
        }
        else {
          // Get the primary insert string.
          param = _sql.toParam();

          route.query = [
            [
              param.text,
              ...param.values
            ]
          ];

          _sql = _squel
            .select(defaultSettings)
            .from(path.toString())
            .where(`${primary} = ?`,primaryComparison);
          param = _sql.toParam();

          route.query.push([
            param.text,
            ...param.values
          ]);
        }

        break;
      case 'delete':
        route.method = 'DELETE';
        route.endpoint += '/:id';
        _sql = _squel
          .delete(defaultSettings)
          .from(path.toString())
          .where(`${primary} = ?`,primaryComparison);
          param = _sql.toParam();

          route.query = [
            [
              param.text,
              ...param.values
            ]
          ];
        break;
    }

    return route;
  }

  function actionsToRoutes(req, actions) {
    return Q.ninvoke(formio.cache, 'loadCurrentProject', req)
      .then((project) => {
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
