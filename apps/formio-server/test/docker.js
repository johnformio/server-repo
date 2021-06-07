/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var express = require('express');
var path = require('path');
var async = require('async');
var chance = new (require('chance'))();
var app = null;
var hook = null;
var template = _.cloneDeep(require('./tests/fixtures/template')());
let EventEmitter = require('events');

process.on('uncaughtException', function(err) {
  console.log(err.stack);
});

process.on('unhandledRejection', (err) => {
  console.log(err.stack);
});

describe('Initial Tests', function() {
  before(function(done) {
    var hooks = _.merge(require('formio/test/hooks'), require('./tests/hooks')); // Merge all the test hooks.
    app = 'http://api.localhost:3000';
    hook = require('formio/src/util/hook')({hooks: hooks});
    template.hooks = hooks;
    template.hooks.addEmitter(new EventEmitter());
    return done();
  });

  /**
   * Create a simulated Form.io environment for testing.
   */
  describe('Bootstrap', function() {
    describe('Setup Form.io', function() {

      it('Discovers the formio project', function(done) {
        var getPrimary = function(cb) {
          request(app)
            .get('/')
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              response.forEach(function(project) {
                if (project.name === 'formio') {
                  template.formio = {
                    primary: project,
                    owner: {
                      data: {
                        name: 'admin',
                        email: 'admin@example.com',
                        password: 'password'
                      }
                    }
                  };
                }
              });

              cb();
            });
        };
        var getProject = function(cb) {
          request(app)
            .get('/project/' + template.formio.primary._id)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              template.formio.project = response;

              cb();
            });
        };
        var getForms = function(cb) {
          request(app)
            .get('/project/' + template.formio.project._id + '/form?limit=9999999')
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              response.forEach(function(form) {
                if (form.name === 'userRegistrationForm') {
                  template.formio.formRegister = form;
                }
                else if (form.name === 'userLoginForm') {
                  template.formio.formLogin = form;
                }
                else if (form.name === 'user') {
                  template.formio.userResource = form;
                }
                else if (form.name === 'team') {
                  template.formio.teamResource = form;
                }
                else if (form.name == 'member') {
                  template.formio.memberResource = form;
                }
              });

              cb();
            });
        };

        async.series([
          getPrimary,
          getProject,
          getForms
        ], function(err) {
          if (err) {
            return done(err);
          }

          done();
        });
      });

      it('Form.io owner should be able to login', function(done) {
        request(app)
          .post('/project/' + template.formio.project._id + '/form/' + template.formio.formLogin._id + '/submission')
          .send({
            data: {
              'email': template.formio.owner.data.email,
              'password': template.formio.owner.data.password
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert(response.data.hasOwnProperty('name'), 'The submission `data` should contain the `name`.');
            assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
            assert.equal(response.data.email, template.formio.owner.data.email);
            assert(!response.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
            assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
            assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
            assert.equal(response.form, template.formio.userResource._id);
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

            // Update our testProject.owners data.
            var tempPassword = template.formio.owner.data.password;
            template.formio.owner = response;
            template.formio.owner.data.password = tempPassword;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

    });

    after(function() {
      describe('Project Tests', function() {
        this.retries(4);
        require('./tests/project')(app, template, hook);
        require('./tests/groups')(app, template, hook);
        require('./tests/domain')(app, template, hook);
        require('formio/test/unit')(app, template, hook);
        require('formio/test/auth')(app, template, hook);
        require('./tests/externalTokens')(app, template, hook);
        require('formio/test/roles')(app, template, hook);
        require('formio/test/form')(app, template, hook);
        require('formio/test/resource')(app, template, hook);
        require('formio/test/nested')(app, template, hook);
        require('formio/test/actions')(app, template, hook);
        require('formio/test/submission')(app, template, hook);
        require('formio/test/submission-access')(app, template, hook);
        require('./tests/teams')(app, template, hook);
        require('./tests/env')(app, template, hook);
        require('./tests/tags')(app, template, hook);
        require('./tests/misc')(app, template, hook);
        require('./tests/oauth')(app, template, hook);
        require('./tests/dropbox')(app, template, hook);
        require('./tests/report')(app, template, hook);
        require('./tests/actions')(app, template, hook);
        require('./tests/group-permissions')(app, template, hook);
        require('formio/test/templates')(app, template, hook);
      });
    });
  });
});
