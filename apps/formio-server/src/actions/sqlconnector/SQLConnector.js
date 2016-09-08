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

      var missingSetting = _.find(['host', 'type'], function(prop) {
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
   * Add an externalId to the local resource with the remote id.
   *
   * @param {string} localId
   *   The BSON id for the local resource.
   * @param {string} remoteId
   *   The external resource id.
   */
  var addExternalId = function(localId, remoteId) {
    var _find = {_id: localId};
    var _update = {
      $push: {
        externalIds: {
          type: 'sqlconnector',
          id: remoteId
        }
      }
    };

    return Q.ninvoke(formio.resources.submission.model, 'update', _find, _update);
  };

  /**
   * Get the externalId for the current submission.
   *
   * @param {object} res
   *   The express response object.
   *
   * @returns {string|undefined}
   *   The external id for the sqlconnector in the submission if defined.
   */
  var getSubmissionId = function(req, res) {
    var id;
    var external;

    // If an item was included in the response
    if (_.has(res, 'resource.item') && req.method !== 'DELETE') {
      external = _.find(_.get(res, 'resource.item.externalIds'), function(item) {
        return item.type === 'sqlconnector';
      });
    }
    else if (req.method === 'DELETE') {
      var deleted = _.get(req, 'formioCache.submissions.' + _.get(req, 'subId'));
      if (!deleted) {
        return undefined;
      }
      external = _.find(_.get(deleted, 'externalIds'), function(item) {
        return item.type === 'sqlconnector';
      });
    }

    id = external
      ? _.get(external, 'id')
      : undefined;

    return id;
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
  SQLConnector.prototype.resolve = function(handler, method, req, res, next) { // eslint-disable-line max-statements
    // Dont block on this action, lots of stuff to do.
    next(); // eslint-disable-line callback-return

    try {
      method = req.method.toString().toLowerCase();
      var options = {
        method: method
      };

      var primary = this.settings.primary;
      var cache = require('../../cache/cache')(formio);
      var project = cache.currentProject(req);
      if (project === null) {
        debug('No project found.');
        return;
      }

      // Add basic auth if available.
      if (_.has(project, 'settings.sqlconnector.user')) {
        _.set(options, 'auth.user', _.get(project, 'settings.sqlconnector.user'));
      }
      if (_.has(project, 'settings.sqlconnector.password')) {
        _.set(options, 'auth.password', _.get(project, 'settings.sqlconnector.password'));
      }

      // Build the base url.
      options.url = _.get(project, 'settings.sqlconnector.host') + '/' + this.settings.table;

      // If this was not a post request, determine which existing resource we are modifying.
      if (method !== 'post') {
        var externalId = getSubmissionId(req, res);
        if (externalId === undefined) {
          debug('No externalId was found in the existing submission.');
          return;
        }

        options.url += '/' + externalId;
      }

      // If this is a create/update, determine what to send in the request body.
      if (['post', 'put'].indexOf(method) !== -1) {
        options.json = true;
        var item = _.has(res, 'resource.item')
          ? (_.get(res, 'resource.item')).toObject()
          : _.get(req, 'body');

        // Remove protected fields from the external request.
        formio.util.removeProtectedFields(req.currentForm, method, item);
        debug('body:');
        debug(item);
        options.body = item;
      }

      debug(options);
      request(options, function(err, response, body) {
        if (err) {
          debug(err);
          return;
        }

        debug(body);

        // Begin link phase for new resources.
        if (method !== 'post') {
          return;
        }

        // Attempt to modify linked resources.
        return Q()
          .then(function() {
            var results = _.get(response, 'body.rows');
            if (!(results instanceof Array)) {
              // No clue what to do here.
              throw new Error('Expected array of results, got ' + typeof results);
            }
            if (results.length === 1) {
              return results[0];
            }

            throw new Error('More than one result: ' + results.length);
          })
          .then(function(remoteItem) {
            // Get the localId
            var localId = _.get(res, 'resource.item._id');
            if (!localId) {
              throw new Error('Unknown local item id: ' + localId);
            }
            // Get the remoteId
            var remoteId = _.get(remoteItem, primary);
            if (!remoteId && remoteId !== 0) {
              throw new Error('Unknown remote item id: ' + remoteId);
            }

            if (method === 'post') {
              return addExternalId(localId, remoteId);
            }
          })
          .catch(function(err) {
            // Do nothing on errors.
            debug(err);
          });
      });
    }
    catch (err) {
      debug(err);
    }
  };

  // Return the SQLConnector.
  return SQLConnector;
};
