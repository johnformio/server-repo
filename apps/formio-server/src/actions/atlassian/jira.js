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

          debug('projects:');
          debug(projects);
          settingsForm.push({
            type: 'select',
            input: true,
            label: 'Project',
            key: 'project',
            placeholder: 'Select the project for all issues created',
            template: '<span>{{ item.name }}</span>',
            dataSrc: 'json',
            data: {
              json: JSON.stringify(projects || [])
            },
            valueProperty: 'id',
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

          debug('types:');
          debug(types);
          settingsForm.push({
            type: 'select',
            input: true,
            label: 'Issue Type',
            key: 'type',
            placeholder: 'Select the Issue Type for all issues created',
            template: '<span>{{ item.name }}</span>',
            dataSrc: 'json',
            data: {
              json: JSON.stringify(types || [])
            },
            valueProperty: 'id',
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

          debug('components:');
          debug(components);
          settingsForm.push({
            type: 'select',
            input: true,
            label: 'Summary',
            key: 'summary',
            placeholder: 'Select the Form Component which will provide the Issue Summary',
            template: '<span>{{ item.label }}</span>',
            dataSrc: 'json',
            data: {
              json: JSON.stringify(components || [])
            },
            valueProperty: 'key',
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

    var jira = null;
    var settings = this.settings;

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
      function checkConfiguration(cb) {
        debug('settings:');
        debug(settings);
        if (!settings) {
          return cb('No settings configured.');
        }
        if (!_.has(settings, 'project')) {
          return cb('No project configured for the Jira action.');
        }
        if (!_.has(settings, 'type')) {
          return cb('No issue type configured for the Jira action.');
        }
        if (!_.has(settings, 'summary')) {
          return cb('No summary form component configured for the Jira action.');
        }

        cb();
      },
      function execute(cb) {
        switch (req.method.toLowerCase()) {
          case 'post':
            jira.issue.createIssue({
              fields: {
                project: {
                  id: _.get(settings, 'project')
                },
                issuetype: {
                  id: _.get(settings, 'type')
                },
                summary: _.get(_.get(req, 'body.data'), _.get(settings, 'summary'))
              }
            }, function(err, issue) {
              if (err) {
                debug(err);
                return;
              }

              debug(issue);

              // Update the submission with an externalId ref to the issue.
              formio.resources.submission.model.update(
                {_id: res.resource.item._id},
                {
                  $push: {
                    externalIds: {
                      type: 'jira',
                      id: _.get(issue, 'id')
                    }
                  }
                },
                cb
              );
            });
            break;
          default:
            cb('Unknown method: ' + req.method.toLowerCase());
        }
      }
    ], function(err, results) {
      if (err) {
        debug(err);
        return;
      }

      return;
    });
  };

  // Return the JiraAction.
  return JiraAction;
};
