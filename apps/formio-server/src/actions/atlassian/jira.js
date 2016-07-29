'use strict';

var _ = require('lodash');
var debug = require('debug')('formio:actions:jira');

module.exports = function(router) {
  var atlassian = require('./util')(router);
  var Action = router.formio.Action;
  var formio = router.formio;
  /**
   * JiraAction class.
   *   This class is used to create jira interface.
   *
   * @constructor
   */
  var JiraAction = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  // Derive from Action.
  JiraAction.prototype = Object.create(Action.prototype);
  JiraAction.prototype.constructor = JiraAction;
  JiraAction.info = function(req, res, next) {
    next(null, {
      name: 'jira',
      title: 'Jira (Premium)',
      premium: true,
      description: 'Allows you to trigger an external interface.',
      priority: 0,
      defaults: {
        handler: ['after'],
        method: ['create']
      }
    });
  };

  JiraAction.settingsForm = function(req, res, next) {
    // Get the project settings.
    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug(err);
        return;
      }

      if (!atlassian.settings.check(settings)) {
        debug('Failed settings check, cant continue.');
        return;
      }

      var jira = atlassian.getJira(settings);
      jira.project.getAllProjects({}, function(err, response) {
        if (err) {
          debug(err);
          return;
        }

        next(null, [
          {
            type: 'select',
            input: true,
            label: 'Project',
            key: 'project',
            placeholder: 'Select the project for all issues created',
            template: '<span>{{ item.name }}</span>',
            dataSrc: 'values',
            data: {
              values: response || []
            },
            multiple: false,
            validate: {
              required: true
            }
          },
          {
            label: 'Summary',
            key: 'summary',
            inputType: 'text',
            defaultValue: '',
            input: true,
            placeholder: 'Summary for the issue',
            type: 'textfield',
            multiple: false
          }
        ]);
      });
    });
  };

  /**
   * Trigger the action.
   *
   * @param {String} handler
   * @param {String} method
   * @param {Object} req
   *   The Express request object.
   * @param {Object} res
   *   The Express response object.
   * @param {Function} next
   *   The callback function to execute upon completion.
   */
  JiraAction.prototype.resolve = function(handler, method, req, res, next) {
    // Dont block on the external request.
    next();

    // Get the project settings.
    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug(err);
        return;
      }

      if (!atlassian.settings.check(settings)) {
        debug('Failed settings check, cant continue.');
        return;
      }

      // Exit if the Action settings are not correct.
      if (!this.settings || ! _.has(this.settings, 'summary')) {
        debug('No summary mapping configured in the jira action.');
        return;
      }

      var options = {
        username: _.get(settings, 'atlassian.username'),
        password: _.get(settings, 'atlassian.password')
      };

      // Make the request.
      switch (req.method.toLowerCase()) {
        case 'post':
          atlassian.issue.create(options, req.body);
          break;
        case 'put':
          break;
        case 'delete':
          break;
      }
    });
  };

  // Return the JiraAction.
  return JiraAction;
};
