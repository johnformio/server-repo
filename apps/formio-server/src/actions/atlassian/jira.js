'use strict';

var _ = require('lodash');
var debug = require('debug')('formio:actions:jira');
var async = require('async');

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
      description: 'Allows you to create issues within Jira.',
      priority: 0,
      defaults: {
        handler: ['after'],
        method: ['create']
      }
    });
  };

  JiraAction.settingsForm = function(req, res, next) {
    var jira = null;
    var settingsForm = [];

    async.series([
      function getSettings(cb) {
        // Get the project settings.
        formio.hook.settings(req, function(err, settings) {
          if (err) {
            return cb(err);
          }

          if (!atlassian.settings.check(settings)) {
            return cb('Failed settings check, cant continue.');
          }

          jira = atlassian.getJira(settings);
          cb();
        });
      },
      function getJiraProjects(cb) {
        // Get all the projects in jira.
        jira.project.getAllProjects({}, function(err, projects) {
          if (err) {
            return cb(err);
          }

          settingsForm.push({
            type: 'select',
            input: true,
            label: 'Project',
            key: 'project',
            placeholder: 'Select the project for all issues created',
            template: '<span>{{ item.name }}</span>',
            dataSrc: 'values',
            data: {
              values: projects || []
            },
            multiple: false,
            validate: {
              required: true
            }
          });

          cb();
        });
      },
      function getJiraIssueTypes(cb) {
        jira.issueType.getAllIssueTypes({}, function(err, types) {
          if (err) {
            return cb(err);
          }

          settingsForm.push({
            type: 'select',
            input: true,
            label: 'Issue Type',
            key: 'type',
            placeholder: 'Select the Issue Type for all issues created',
            template: '<span>{{ item.name }}</span>',
            dataSrc: 'values',
            data: {
              values: types || []
            },
            multiple: false,
            validate: {
              required: true
            }
          });

          cb();
        });
      },
      function getFormComponents(cb) {
        // Load the current form, to get all the components.
        formio.cache.loadCurrentForm(req, function(err, form) {
          if (err) {
            return cb(err);
          }

          // Filter non-input components.
          var components = [];
          formio.util.eachComponent(form.components, function(component) {
            if (!formio.util.isLayoutComponent(component) && component.input === true && component.type !== 'button') {
              components.push(component);
            }
          });

          settingsForm.push({
            type: 'select',
            input: true,
            label: 'Summary',
            key: 'summary',
            placeholder: 'Select the Form Component which will provide the Issue Summary',
            template: '<span>{{ item.label }}</span>',
            dataSrc: 'values',
            data: {
              values: components || []
            },
            multiple: false,
            validate: {
              required: true
            }
          });

          cb()
        });
      }
    ], function(err) {
      if (err) {
        debug(err);
        return;
      }

      return next(null, settingsForm);
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
          jira.issue.createIssue({}, function(err, issue) {
            if (err) {
              debug(err);
              return;
            }

            return;
          });
          break;
        case 'put':
          jira.issue.editIssue({}, function(err, issue) {
            if (err) {
              debug(err);
              return;
            }

            return;
          });
          break;
        case 'delete':
          jira.issue.deleteIssue({}, function(err, issue) {
            if (err) {
              debug(err);
              return;
            }

            return;
          });
          break;
      }
    });
  };

  // Return the JiraAction.
  return JiraAction;
};
