/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var Q = require('q');
var sinon = require('sinon');
var moment = require('moment');
var async = require('async');
var chance = new (require('chance'))();
var uuidRegex = /^([a-z]{15})$/;
var util = require('formio/src/util/util');
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;

module.exports = function(app, template, hook) {
  describe('Closed Source Actions', function() {
    describe('SQL Connector', function() {
      var helper;
      it('Create the test project', function(done) {
        helper = new template.Helper(template.formio.owner);
        helper
          .project({
            sqlconnector: {
              host: 'example.com',
              type: 'mysql'
            }
          })
          .resource([
            {
              input: true,
              tableView: true,
              inputType: 'text',
              inputMask: '',
              label: 'fname',
              key: 'fname',
              placeholder: '',
              prefix: '',
              suffix: '',
              multiple: false,
              defaultValue: '',
              protected: false,
              unique: false,
              persistent: true,
              validate: {
                required: false,
                minLength: '',
                maxLength: '',
                pattern: '',
                custom: '',
                customPrivate: false
              },
              conditional: {
                show: '',
                when: null,
                eq: ''
              },
              type: 'textfield'
            },
            {
              input: true,
              tableView: true,
              inputType: 'text',
              inputMask: '',
              label: 'lname',
              key: 'lname',
              placeholder: '',
              prefix: '',
              suffix: '',
              multiple: false,
              defaultValue: '',
              protected: false,
              unique: false,
              persistent: true,
              validate: {
                required: false,
                minLength: '',
                maxLength: '',
                pattern: '',
                custom: '',
                customPrivate: false
              },
              conditional: {
                show: '',
                when: null,
                eq: ''
              },
              type: 'textfield'
            }
          ])
          .action({
            title: 'SQLConnector',
            name: 'sqlconnector',
            priority: 1,
            handler: ['after'],
            method: ['create', 'read', 'update', 'delete', 'index'],
            settings: {
              fields: [
                {
                  field: {
                    input: true,
                    tableView: true,
                    inputType: 'text',
                    inputMask: '',
                    label: 'fname',
                    key: 'fname',
                    placeholder: '',
                    prefix: '',
                    suffix: '',
                    multiple: false,
                    defaultValue: '',
                    protected: false,
                    unique: false,
                    persistent: true,
                    validate: {
                      required: false,
                      minLength: '',
                      maxLength: '',
                      pattern: '',
                      custom: '',
                      customPrivate: false
                    },
                    conditional: {
                      show: '',
                      when: null,
                      eq: ''
                    },
                    type: 'textfield'
                  },
                  column: 'firstName'
                },
                {
                  field: {
                    input: true,
                    tableView: true,
                    inputType: 'text',
                    inputMask: '',
                    label: 'lname',
                    key: 'lname',
                    placeholder: '',
                    prefix: '',
                    suffix: '',
                    multiple: false,
                    defaultValue: '',
                    protected: false,
                    unique: false,
                    persistent: true,
                    validate: {
                      required: false,
                      minLength: '',
                      maxLength: '',
                      pattern: '',
                      custom: '',
                      customPrivate: false
                    },
                    conditional: {
                      show: '',
                      when: null,
                      eq: ''
                    },
                    type: 'textfield'
                  },
                  column: 'lastName'
                }
              ],
              primary: 'id',
              table: 'customers'
            }
          })
          .execute(done);
      });

      var project;
      it('Verify the project has sql connector settings', function(done) {
        helper.getProject(function(err, response) {
          if (err) {
            return done(err);
          }

          assert(typeof response === 'object');
          assert.deepEqual(response.settings, {
            sqlconnector: {
              host: 'example.com',
              type: 'mysql'
            },
            cors: '*'
          });
          project = response;
          done();
        });
      });

      it('A project on the basic plan cannot access the /sqlconnector endpoint', function(done) {
        request(app)
          .get('/project/' + project._id + '/sqlconnector')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /text/)
          .expect(402)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.text;
            assert.equal(response, 'The current project must be upgraded to access the SQL Connector');
            done();
          });
      });

      if (!docker && !customer)
      it('Update the project to the independent plan', function(done) {
        app.formio.formio.resources.project.model.findOne({_id: project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) {
            return done(err);
          }

          project.plan = 'independent';
          project.save(function(err) {
            if (err) {
              return done(err);
            }

            helper.getProject(function(err, response) {
              if (err) {
                return done(err);
              }

              project = response;
              done();
            });
          });
        });
      });

      if (!docker && !customer)
      it('A project on the independent plan cannot access the /sqlconnector endpoint', function(done) {
        request(app)
          .get('/project/' + project._id + '/sqlconnector')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /text/)
          .expect(402)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.text;
            assert.equal(response, 'The current project must be upgraded to access the SQL Connector');
            done();
          });
      });

      if (!docker && !customer)
      it('Update the project to the team plan', function(done) {
        app.formio.formio.resources.project.model.findOne({_id: project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) {
            return done(err);
          }

          project.plan = 'team';
          project.save(function(err) {
            if (err) {
              return done(err);
            }

            helper.getProject(function(err, response) {
              if (err) {
                return done(err);
              }

              project = response;
              done();
            });
          });
        });
      });

      if (!docker && !customer)
      it('A project on the team plan can access the /sqlconnector endpoint', function(done) {
        request(app)
          .get('/project/' + project._id + '/sqlconnector')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response instanceof Array);
            assert.equal(response.length, 5);
            response.forEach(function(item) {
              assert.deepEqual(['endpoint', 'method', 'query'], Object.keys(item));
              assert.notEqual(['POST', 'GET', 'PUT', 'DELETE', 'INDEX'].indexOf(item.method), -1);
            });

            done();
          });
      });
    });
  });
};
