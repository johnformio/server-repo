'use strict';

var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var debug = require('debug')('formio:error');

module.exports = function(formio, done) {
  var hook = require('formio/src/util/hook')(formio);

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASS) {
    return done(
      'Cannot set up server. Please set environment variables for ADMIN_EMAIL and ADMIN_PASS and restart the server.'
    );
  }

  var importer = require('formio/src/templates/import')(formio);
  var template;
  var project;
  var user;
  var steps = {
    readJson: function(done) {
      /* eslint-disable no-console */
      console.log(' > Setting up formio project.');
      /* eslint-enable no-console */

      try {
        fs.readFile('./deployment/import/formio.json', function(err, data) {
          if (err) {
            return done(err);
          }

          template = JSON.parse(data);
          done();
        });
      }
      catch (err) {
        debug(err);
        return done(err);
      }
    },
    importProject: function(done) {
      var parseProject = function(template, item) {
        var project = _.cloneDeep(template);
        delete project.roles;
        delete project.forms;
        delete project.actions;
        delete project.resources;
        return project;
      };

      /* eslint-disable no-console */
      console.log(' > Importing formio project.');
      /* eslint-enable no-console */
      importer.project = importer.createInstall(formio.mongoose.models.project, parseProject);
      var items = {};
      items[template.name] = '';
      importer.project(template, items, function(err) {
        if (err) {
          return done(err);
        }

        project = items[template.name];
        done();
      });
    },
    importItems: function(done) {
      /* eslint-disable no-console */
      console.log(' > Importing roles, forms, resources, and actions.');
      /* eslint-enable no-console */

      // Add project id to roles and forms.
      var alter = {
        role: function(item, done) {
          item.project = project._id;
          hook.alter('roleMachineName', item.machineName, item, function(err, machineName) {
            if (err) {
              done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        },
        form: function(item, done) {
          item.project = project._id;
          hook.alter('formMachineName', item.machineName, item, function(err, machineName) {
            if (err) {
              done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        },
        action: function(item, done) {
          hook.alter('actionMachineName', item.machineName, item, function(err, machineName) {
            if (err) {
              done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        }
      };
      importer.template(template, alter, function(err, template) {
        if (err) {
          return done(err);
        }

        done();
      });
    },
    createRootAccount: function(done) {
      /* eslint-disable no-console */
      console.log(' > Creating root user account.');
      /* eslint-enable no-console */

      formio.encrypt(process.env.ADMIN_PASS, function(err, hash) {
        if (err) {
          return done(err);
        }

        // Create the root user submission.
        formio.resources.submission.model.create({
          form: template.resources.user._id,
          data: {
            email: process.env.ADMIN_EMAIL,
            password: hash
          },
          roles: [
            template.roles.administrator._id
          ]
        }, function(err, data) {
          if (err) {
            return done(err);
          }

          user = data;
          done();
        });
      });
    },
    updateProject: function(done) {
      /* eslint-disable no-console */
      console.log(' > Updating project with owner and roles.');
      /* eslint-enable no-console */
      formio.resources.project.model.findOne({_id: project._id}, function(err, project) {
        if (err) {
          return done(err);
        }

        project.access = [
          {
            type: 'create_all',
            roles: [
              template.roles.administrator._id
            ]
          },
          {
            type: 'read_all',
            roles: [
              template.roles.administrator._id,
              template.roles.anonymous._id
            ]
          },
          {
            type: 'update_all',
            roles: [
              template.roles.administrator._id
            ]
          },
          {
            type: 'delete_all',
            roles: [
              template.roles.administrator._id
            ]
          }
        ];
        project.owner = user._id;
        project.save();
        done();
      });
    }
  };

  async.series([
    steps.readJson,
    steps.importProject,
    steps.importItems,
    steps.createRootAccount,
    steps.updateProject
  ], function(err, result) {
    if (err) {
      /* eslint-disable no-console */
      console.log(err);
      /* eslint-enable no-console */
      return done(err);
    }

    /* eslint-disable no-console */
    console.log(' > Finished setting up formio project.');
    /* eslint-enable no-console */
    done();
  });
};
