'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:actions:jira');
const async = require('async');

module.exports = function(router) {
  const atlassian = require('./util')(router);
  const Action = router.formio.Action;
  const formio = router.formio;
  const hook = router.formio.hook;

  /**
   * JiraAction class.
   *   This class is used to create jira interface.
   */
  class JiraAction extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'jira',
        title: 'Jira',
        description: 'Allows you to create issues within Jira.',
        priority: 0,
        defaults: {
          handler: ['after'],
          method: ['create', 'update', 'delete']
        }
      }));
    }

    static settingsForm(req, res, next) {
      let jira = null;
      const settingsForm = [
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
          hideLabel: false,
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
              return cb('Failed Atlassian settings check. Configure the Atlassian Data Connection before continuing.');
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
              const components = [];
              const emailComponents = [];
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
          return next(err);
        }

        return next(null, settingsForm);
      });
    }

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
    resolve(handler, method, req, res, next) {
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      let jira = null;
      const settings = this.settings;
      let _issue = undefined;

      // Only block on the external request, if configured
      if (!_.has(settings, 'block') || settings.block === false) {
        /* eslint-disable callback-return */
        next();
        /* eslint-enable callback-return */
      }

      const issue = {
        create(cb) {
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
              return cb(err);
            }

            if (_.has(issue, 'errorMessages')) {
              return cb(issue);
            }

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
        update(cb) {
          // Only update submissions that have been connected to jira.
          if (_.has(res, 'resource.item')) {
            const item = res.resource.item.toObject();
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

            if (_.has(issue, 'errorMessages')) {
              return cb(issue);
            }

            cb();
          });
        },
        delete(cb) {
          const deleted = _.get(req, `formioCache.submissions.${_.get(req, 'subId')}`);
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

          jira.issue.deleteIssue({
            issueId: _issue
          }, function(err, issue) {
            if (err) {
              debug(err);
            }

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
              return cb(`Unknown method: ${req.method.toLowerCase()}`);
          }
        },
        function assignUsers(cb) {
          /**
           * Assign the given user to the current issue.
           *
           * @param user
           * @param callback
           */
          const assign = function(user, callback) {
            jira.issue.assignIssue({
              issueId: _issue,
              assignee: _.get(user, 'name') || null
            }, function(err, response) {
              if (err) {
                return callback(err);
              }

              return callback();
            });
          };

          // Only attempt to assign users on post/put methods.
          if (req.method.toLowerCase() === 'delete' || req.method.toLowerCase() === 'get') {
            return cb(null, _issue);
          }

          // Only attempt to assign users, if the user field is configured.
          if (!_.has(settings, 'user')) {
            return cb(null, _issue);
          }

          // If no data was supplied for the user, but the assignment setting is enabled, skip this.
          if (!_.has(_.get(req, 'body.data'), _.get(settings, 'user'))) {
            return assign(null, function() {
              return cb(null, _issue);
            });
          }

          jira.user.search({username: _.get(_.get(req, 'body.data'), _.get(settings, 'user'))}, function(err, users) {
            if (err) {
              return cb(err);
            }

            if (!(users instanceof Array)) {
              return cb('Could not get jira users');
            }

            // If no users were returned, attempt to create one.
            if (users.length === 0) {
              const email = _.get(_.get(req, 'body.data'), _.get(settings, 'user'));
              let username = email;
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

                return assign(user, cb);
              });
            }

            // Check if we have our user
            else if (users.length === 1) {
              users = _.first(users);
              return assign(users, cb);
            }
            else {
              return cb('Could not determine which user to assign the issue to.');
            }
          });
        }
      ], function(err, results) {
        if (err) {
          if (typeof err !== 'string') {
            err = JSON.stringify(err);
          }

          if (_.has(settings, 'block') && settings.block === true) {
            return next(err);
          }

          return;
        }

        if (_.has(settings, 'block') && settings.block === true) {
          return next(null, results);
        }

        return;
      });
    }
  }

  // Return the JiraAction.
  return JiraAction;
};
