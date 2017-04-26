'use strict';

var async = require('async');
var fs = require('fs');
var debug = require('debug')('formio:error');

module.exports = function(router, done) {
  let formio = router.formio;
  var hook = require('formio/src/util/hook')(formio);

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASS) {
    return done(
      'Cannot set up server. Please set environment variables for ADMIN_EMAIL and ADMIN_PASS and restart the server.'
    );
  }

  var importer = require('formio/src/templates/import')(router);
  var template;
  var user;

  // Add project id to roles and forms.
  let alters;

  var steps = {
    readJson: function(done) {
      /* eslint-disable no-console */
      console.log(' > Setting up formio project.');
      /* eslint-enable no-console */

      try {
        fs.readFile('./project.json', function(err, data) {
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
    importItems: function(done) {
      alters = hook.alter(`templateAlters`, {}, template);

      /* eslint-disable no-console */
      console.log(' > Importing roles, forms, resources, and actions.');
      /* eslint-enable no-console */
      importer.template(template, alters, function(err) {
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
      formio.resources.project.model.findOne({_id: template._id}, function(err, project) {
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
              template.roles.authenticated._id,
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
        project.primary = true;
        project.save(done);
      });
    }
  };

  async.series([
    steps.readJson,
    steps.importItems,
    steps.createRootAccount,
    steps.updateProject
  ], function(err) {
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
