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
        method: ['create', 'update', 'delete']
      }
    });
  };

  JiraAction.settingsForm = function(req, res, next) {
    var jira = null;
    var settingsForm = [
      {
        conditional: {
          eq: '',
          when: null,
          show: ''
        },
        type: 'checkbox',
        validate: {
          required: false
        },
        persistent: true,
        protected: false,
        defaultValue: false,
        key: 'block',
        label: 'Block request for Jira feedback',
        hideLabel: true,
        tableView: true,
        inputType: 'checkbox',
        input: true
      }
    ];

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
          if (!jira) {
            return cb('Could not connect to jira.');
          }

          cb();
        });
      },
      function getJiraProjects(cb) {
        try {
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
        }
        catch (e) {
          return cb('Could not load the settings form.');
        }
      },
      function getJiraIssueTypes(cb) {
        try {
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
        }
        catch (e) {
          return cb('Could not load the settings form.');
        }
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
            var emailComponents = [];
            formio.util.eachComponent(form.components, function(component) {
              if (
                !formio.util.isLayoutComponent(component) &&
                component.input === true &&
                component.type !== 'button' &&
                component.type !== 'email'
              ) {
                components.push(component);
              }

              if (component.type === 'email') {
                emailComponents.push(component);
              }
            });

            debug('components:');
            debug(components);
            settingsForm.push(
              {
                type: 'select',
                input: true,
                label: 'User Summary Input Field',
                key: 'summary',
                placeholder: 'Select the Form Component which will provide the Users Issue Summary',
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
              },
              {
                type: 'select',
                input: true,
                label: 'User Email Input Field',
                key: 'user',
                placeholder: 'Select the Form Component which will provide the Users Email Address',
                template: '<span>{{ item.label }}</span>',
                dataSrc: 'json',
                data: {
                  json: JSON.stringify(emailComponents || [])
                },
                valueProperty: 'key',
                multiple: false,
                validate: {
                  required: false
                }
              }
            );

            cb();
          });
        }
        catch (e) {
          return cb('Could not load the settings form.');
        }
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
    var jira = null;
    var settings = this.settings;
    var iterations = 0;
    var _issue = undefined;

    // Only block on the external request, if configured
    if (!_.has(settings, 'block') || settings.block === false) {
      return next();
    }

    var issue = {
      create: function(cb) {
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
            return cb(err);
          }

          debug('New Issue:');
          debug(issue);
          _issue = issue;

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
      },
      update: function(cb) {
        // Only update submissions that have been connected to jira.
        if (_.has(res, 'resource.item')) {
          var item = res.resource.item.toObject();
          if (!_.has(item, 'externalIds')) {
            return cb('No Jira issue is connected to this submission');
          }
          else {
            // Get the id for the issue.
            _issue = _.find(item.externalIds, function(item) {
              return item.type === 'jira';
            });
            _issue = _issue
              ? _.get(_issue, 'id')
              : undefined;
          }
        }
        else {
          return cb('No resource to check.');
        }

        // Only continue if a issue id exists.
        if (_issue === undefined) {
          return cb('No Jira issue id set on this submission');
        }

        debug('issueId: ' + _issue);
        jira.issue.editIssue({
          issue: {
            fields: {
              summary: _.get(_.get(req, 'body.data'), _.get(settings, 'summary'))
            }
          },
          issueId: _issue
        }, function(err, issue) {
          if (err) {
            return cb(err);
          }

          debug(issue);
          cb();
        });
      },
      delete: function(cb) {
        var deleted = _.get(req, 'formioCache.submissions.' + _.get(req, 'subId'));
        if (!deleted) {
          return cb();
        }

        // Get the id for the issue.
        _issue = _.find(_.get(deleted, 'externalIds'), function(item) {
          return item.type === 'jira';
        });
        _issue = _issue
          ? _.get(_issue, 'id')
          : undefined;

        // Only continue if a issue id exists.
        if (_issue === undefined) {
          return cb('No Jira issue id set on this submission');
        }

        debug('issueId: ' + _issue);
        jira.issue.deleteIssue({
          issueId: _issue
        }, function(err, issue) {
          if (err) {
            debug(err);
          }

          debug(issue);
          cb();
        });
      }
    };

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
          if (!jira) {
            return cb('Could not connect to jira.');
          }

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
            issue.create(cb);
            break;
          case 'put':
            issue.update(cb);
            break;
          case 'delete':
            issue.delete(cb);
            break;
          default:
            return cb('Unknown method: ' + req.method.toLowerCase());
        }
      },
      function assignUsers(cb) {
        // Only attempt to assign users on post/put methods.
        if (req.method.toLowerCase() === 'delete' || req.method.toLowerCase() === 'get') {
          debug('Skipping user assignment (' + req.method.toLowerCase() + ')');
          return cb(null, _issue);
        }

        // Only attempt to assign users, if the user field is configured.
        if (!_.has(settings, 'user')) {
          return cb(null, _issue);
        }

        /**
         * Assign the given user to the current issue.
         *
         * @param user
         * @param callback
         */
        var assign = function(user, callback) {
          jira.issue.assignIssue({
            issueId: _issue,
            assignee: _.get(user, 'name')
          }, function(err, response) {
            if (err) {
              return callback(err);
            }

            debug('Response:');
            debug(response);

            return callback();
          });
        };

        jira.user.search({username: _.get(_.get(req, 'body.data'), _.get(settings, 'user'))}, function(err, users) {
          if (err) {
            return cb(err);
          }

          if (!(users instanceof Array)) {
            return cb('Could not get jira users');
          }

          // If no users were returned, attempt to create one.
          if (users.length === 0) {
            var email = _.get(_.get(req, 'body.data'), _.get(settings, 'user'));
            var username = email;
            if (email.toString().indexOf('@') !== -1) {
              username = _.first(email.split('@'));
            }

            jira.user.createUser({
              user: {
                name: username,
                displayName: username,
                emailAddress: email
              }
            }, function(err, user) {
              if (err) {
                return cb(err);
              }

              debug('New user:');
              debug(user);
              return assign(user, cb);
            });
          }

          // Check if we have our user
          else if (users.length === 1) {
            users = _.first(users);
            debug('One user found');
            debug(users);
            return assign(users, cb);
          }
          else {
            debug('Too many users to select one..');
            debug(users);
            return cb('Could not determine which user to assign the issue to.');
          }
        });
      }
    ], function(err, results) {
      if (err) {
        debug(err);

        if (_.has(err, 'errorMessages')) {
          err = JSON.stringify(err.errorMessages);
        }

        if (_.has(settings, 'block') && settings.block === true) {
          return next(err);
        }

        return;
      }

      debug('results:');
      debug(results);
      if (_.has(settings, 'block') && settings.block === true) {
        return next(null, results);
      }

      return;
    });
  };

  // Return the JiraAction.
  return JiraAction;
};
