'use strict';

var _ = require('lodash');
var async = require('async');
var debug = require('debug')('formio:action:sqlconnector');
var Q = require('q');
var request = require('request');

module.exports = function(router) {
  var Action = router.formio.Action;
  var formio = router.formio;

  /**
   * SQLConnector class.
   *   This class is used to integrate into external SQL Databases.
   *
   * @constructor
   */
  var SQLConnector = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  // Derive from Action.
  SQLConnector.prototype = Object.create(Action.prototype);
  SQLConnector.prototype.constructor = SQLConnector;
  SQLConnector.info = function(req, res, next) {
    next(null, {
      name: 'sqlconnector',
      title: 'SQL Connector (Premium)',
      premium: true,
      description: 'Allows you to execute a remote SQL Query via Resquel.',
      priority: 0,
      defaults: {
        handler: ['after'],
        method: ['create', 'read', 'update', 'delete', 'index']
      }
    });
  };
  SQLConnector.settingsForm = function(req, res, next) {
    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug(err);
        return next(null, {});
      }

      settings = settings || {};
      if (!settings.sqlconnector) {
        return next('No project settings were found for the SQL Connector.');
      }

      var missingSetting = _.find(['host', 'type', 'user', 'password'], function(prop) {
        return !settings.sqlconnector[prop];
      });
      if (missingSetting) {
        debug(missingSetting);
        return next('The SQL Connector is missing required settings.');
      }

      var form = [];
      async.waterfall([
        function addTableName(cb) {
          form.push({
            label: 'Table Name',
            key: 'table',
            inputType: 'text',
            defaultValue: '',
            input: true,
            placeholder: 'Which table is this in?',
            prefix: '',
            suffix: '',
            type: 'textfield',
            multiple: false,
            validate: {
              required: true
            }
          });
          return cb();
        },
        function addTablePrimaryKey(cb) {
          form.push({
            label: 'Primary Key',
            key: 'primary',
            inputType: 'text',
            defaultValue: 'id',
            input: true,
            placeholder: 'What is the primary key for this table? (Must be self incrementing/updating)',
            prefix: '',
            suffix: '',
            type: 'textfield',
            multiple: false,
            validate: {
              required: true
            }
          });
          return cb();
        },
        function getFormComponents(cb) {
          try {
            // Load the current form, to get all the components.
            formio.cache.loadCurrentForm(req, function(err, form) {
              if (err) {
                return cb(err);
              }

              // Filter non-input components.
              var components = [];
              formio.util.eachComponent(form.components, function(component) {
                if (
                  !formio.util.isLayoutComponent(component) &&
                  component.input === true &&
                  component.type !== 'button' &&
                  component.type !== 'email'
                ) {
                  components.push(component);
                }
              });

              debug('components:');
              debug(components);
              return cb(null, components);
            });
          }
          catch (e) {
            return cb('Could not load the settings form.');
          }
        },
        function addMappingDatagrid(components, cb) {
          form.push({
            conditional: {
              eq: '',
              when: null,
              show: ''
            },
            tags: [],
            type: 'datagrid',
            persistent: true,
            protected: false,
            key: 'fields',
            label: 'Fields',
            tableView: true,
            components: [{
              lockKey: true,
              tags: [],
              hideLabel: true,
              type: 'textfield',
              conditional: {
                eq: '',
                when: null,
                show: ''
              },
              validate: {
                customPrivate: false,
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: false
              },
              persistent: true,
              unique: false,
              protected: false,
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: '',
              key: 'column',
              label: 'Column Name',
              inputMask: '',
              inputType: 'text',
              tableView: true,
              input: true
            }, {
              conditional: {
                eq: '',
                when: null,
                show: ''
              },
              tags: [],
              hideLabel: true,
              type: 'select',
              validate: {
                required: false
              },
              persistent: true,
              unique: false,
              protected: false,
              multiple: false,
              template: '<span>{{ item.label }}</span>',
              authenticate: false,
              filter: '',
              refreshOn: '',
              defaultValue: '',
              valueProperty: '',
              dataSrc: 'json',
              data: {
                json: JSON.stringify(components || [])
              },
              placeholder: '',
              key: 'field',
              label: 'Field',
              tableView: true,
              input: true
            }],
            tree: true,
            input: true
          });
          return cb();
        }
      ], function(err) {
        if (err) {
          return next(err);
        }

        return next(null, form);
      });
    });
  };

  /**
   * Trigger the Resquel request.
   *
   * @param handler
   * @param method
   * @param req
   *   The Express request object.
   * @param res
   *   The Express response object.
   * @param next
   *   The callback function to execute upon completion.
   */
  SQLConnector.prototype.resolve = function(handler, method, req, res, next) {
    try {
      method = req.method.toString().toLowerCase();
      var options = {
        method: method
      };

      var cache = require('../../cache/cache')(formio);
      var project = cache.currentProject(req);
      if (project === null) {
        throw new Error('No Project found.');
      }

      options.url = _.get(project, 'settings.sqlconnector.host') + '/' + this.settings.table;
      options.url += _.has(req, 'subId')
        ? '/' + _.get(req, 'subId')
        : '';

      if (['post', 'put'].indexOf(method) !== 1) {
        options.json = true;
        var item = _.has(res, 'resource.item')
          ? _.get(res, 'resource.item')
          : _.get(req, 'body');

        // Remove protected fields.
        formio.util.removeProtectedFields(req.currentForm, method, item);
        options.body = item;
      }

      debug(options);
      request(options, function(err, response, body) {
        if (err) {
          debug(err);
          return res.sendStatus(400);
        }

        // TODO Add project dashboard messaging for errors.
        debug(response);
        debug(body);
        return next();
      });
    }
    catch (err) {
      debug(err);
      return next(err);
    }
  };

  // Return the SQLConnector.
  return SQLConnector;
};
