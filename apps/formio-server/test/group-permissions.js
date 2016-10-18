/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var Q = require('q');
var async = require('async');
var chance = new (require('chance'))();
var util = require('formio/src/util/util');
var async = require('async');
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;

module.exports = function(app, template, hook) {
  var deleteForms = function(forms, next) {
    async.each(forms, function(item, cb) {
      request(app)
        .delete(hook.alter('url', '/form', template) + '/' + item._id)
        .set('x-jwt-token', template.users.admin.token)
        .end(function(err, res) {
          if (err) {
            return cb(err);
          }

          cb();
        });
    }, function(err) {
      if (err) {
        return next(err);
      }

      return next();
    });
  };

  var deleteSubmissions = function(submissions, next) {
    async.each(submissions, function(item, cb) {
      request(app)
        .delete(hook.alter('url', '/form', template) + '/' + item.form + '/submission/' + item._id)
        .set('x-jwt-token', template.users.admin.token)
        .end(function(err, res) {
          if (err) {
            return cb(err);
          }

          cb();
        });
    }, function(err) {
      if (err) {
        return next(err);
      }

      return next();
    });
  };

  var userHasGroupRole = function(user, role, done) {
    // Check that the user had the role added to their user obj.
    request(app)
      .get('/project/' + template.project._id + '/form/' + user.form + '/submission/' + user._id)
      .set('x-jwt-token', user.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }

        var response = res.body;
        assert(response.roles.indexOf(role) !== -1);

        done();
      });
  };

  describe('Group Permissions', function() {
    describe('Group Assignment Action', function() {
      var form = {
        input: null
      };
      var resource = {
        group: null,
        groupUser: null
      };
      var action = {
        groupAssignment: null
      };
      var submissions = [];

      describe('Bootstrap', function() {
        it('Create the input form', function(done) {
          form.input = {
            title: 'form',
            name: chance.word(),
            path: chance.word(),
            type: 'form',
            access: [],
            submissionAccess: [],
            components: [
              {
                type: 'textfield',
                validate: {
                  custom: '',
                  pattern: '',
                  maxLength: '',
                  minLength: '',
                  required: false
                },
                defaultValue: '',
                multiple: false,
                suffix: '',
                prefix: '',
                placeholder: 'foo',
                key: 'foo',
                label: 'foo',
                inputMask: '',
                inputType: 'text',
                input: true
              }
            ]
          };

          request(app)
            .post('/project/' + template.project._id + '/form')
            .set('x-jwt-token', template.users.admin.token)
            .send(form.input)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
              assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
              assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
              assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
              assert.equal(response.title, form.input.title);
              assert.equal(response.name, form.input.name);
              assert.equal(response.path, form.input.path);
              assert.equal(response.type, form.input.type);
              assert.deepEqual(response.submissionAccess, form.input.submissionAccess);
              assert.deepEqual(response.components, form.input.components);

              form.input = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create the group resource', function(done) {
          resource.group = {
            title: 'groupResource',
            name: chance.word(),
            path: chance.word(),
            type: 'resource',
            access: [],
            submissionAccess: [],
            components: [
              {
                type: 'textfield',
                validate: {
                  custom: '',
                  pattern: '',
                  maxLength: '',
                  minLength: '',
                  required: false
                },
                defaultValue: '',
                multiple: false,
                suffix: '',
                prefix: '',
                placeholder: 'name',
                key: 'name',
                label: 'name',
                inputMask: '',
                inputType: 'text',
                input: true
              }
            ]
          };

          request(app)
            .post('/project/' + template.project._id + '/form')
            .set('x-jwt-token', template.users.admin.token)
            .send(resource.group)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
              assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
              assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
              assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
              assert.equal(response.title, resource.group.title);
              assert.equal(response.name, resource.group.name);
              assert.equal(response.path, resource.group.path);
              assert.equal(response.type, resource.group.type);
              assert.deepEqual(response.submissionAccess, resource.group.submissionAccess);
              assert.deepEqual(response.components, resource.group.components);
              resource.group = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create the group user resource', function(done) {
          resource.groupUser = {
            title: 'groupUser',
            name: chance.word(),
            path: chance.word(),
            type: 'resource',
            access: [],
            submissionAccess: [],
            components: [
              {
                input: true,
                tableView: true,
                label: 'Group',
                key: 'group',
                placeholder: '',
                resource: resource.group,
                project: template.project._id,
                defaultValue: '',
                template: '<span>{{ item.data }}</span>',
                selectFields: '',
                searchFields: '',
                multiple: false,
                protected: false,
                persistent: true,
                validate: {
                  required: false
                },
                defaultPermission: '',
                type: 'resource',
                tags: [],
                conditional: {
                  show: '',
                  when: null,
                  eq: ''
                }
              }, {
                input: true,
                tableView: true,
                label: 'User',
                key: 'user',
                placeholder: '',
                resource: template.users.user1.form,
                project: template.project._id,
                defaultValue: '',
                template: '<span>{{ item.data }}</span>',
                selectFields: '',
                searchFields: '',
                multiple: false,
                protected: false,
                persistent: true,
                validate: {
                  required: false
                },
                defaultPermission: '',
                type: 'resource',
                tags: [],
                conditional: {
                  show: '',
                  when: null,
                  eq: ''
                }
              }
            ]
          };

          request(app)
            .post('/project/' + template.project._id + '/form')
            .set('x-jwt-token', template.users.admin.token)
            .send(resource.groupUser)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
              assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
              assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
              assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
              assert.equal(response.title, resource.groupUser.title);
              assert.equal(response.name, resource.groupUser.name);
              assert.equal(response.path, resource.groupUser.path);
              assert.equal(response.type, resource.groupUser.type);
              assert.deepEqual(response.submissionAccess, resource.groupUser.submissionAccess);
              assert.deepEqual(response.components, resource.groupUser.components);
              resource.groupUser = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            })
        });

        it('Create the group resource assignment action', function(done) {
          action.groupAssignment = {
            title: 'Group Assignment',
            name: 'group',
            handler: ['after'],
            method: ['create'],
            settings: {
              group: 'group',
              user: 'user'
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.groupUser._id + '/action')
            .set('x-jwt-token', template.users.admin.token)
            .send(action.groupAssignment)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
              assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
              assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
              assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
              assert.equal(response.title, action.groupAssignment.title);
              assert.equal(response.name, action.groupAssignment.name);
              assert.equal(response.path, action.groupAssignment.path);
              assert.equal(response.type, action.groupAssignment.type);
              assert.deepEqual(response.submissionAccess, action.groupAssignment.submissionAccess);
              assert.deepEqual(response.components, action.groupAssignment.components);
              action.groupAssignment = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            })
        });
      });

      describe('Group Resource Assignment', function() {
        var group = {
          read: null,
          write: null,
          admin: null,
          none: null
        };

        before(function() {
          submissions = [];
        });

        it('Create a group w/ read access permissions', function(done) {
          group.read = {
            data: {
              name: 'Group1'
            },
            access: [
              {
                type: 'read',
                resources: [
                  template.users.user1._id
                ]
              }
            ]
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .post(group.read)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              group.read = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create a group w/ write access permissions', function(done) {
          group.write = {
            data: {
              name: 'Group2'
            },
            access: [
              {
                type: 'write',
                resources: [
                  template.users.user1._id
                ]
              }
            ]
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .post(group.write)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              group.write = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create a group w/ admin access permissions', function(done) {
          group.admin = {
            data: {
              name: 'Group3'
            },
            access: [
              {
                type: 'admin',
                resources: [
                  template.users.user1._id
                ]
              }
            ]
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .post(group.admin)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              group.admin = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create a group w/ no access permissions', function(done) {
          group.none = {
            data: {
              name: 'Group4'
            },
            access: []
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .post(group.none)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              group.none = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A submission to the group user proxy will not assign group access with no resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .post({
              data: {
                group: group.none._id,
                user: template.users.user1
              }
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');
              done()
            });
        });

        it('A submission to the group user proxy will not assign group access with read resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .post({
              data: {
                group: group.read._id,
                user: template.users.user1
              }
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');
              done()
            });
        });

        it('A submission to the group user proxy will assign group access with write resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .post({
              data: {
                group: group.write._id,
                user: template.users.user1
              }
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              submissions.push(response);
              userHasGroupRole(template.users.user1, group.write._id, done);
            });
        });

        it('A submission to the group user proxy will assign group access with admin resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .post({
              data: {
                group: group.admin._id,
                user: template.users.user1
              }
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              submissions.push(response);
              userHasGroupRole(template.users.user1, group.admin._id, done);
            });
        });

        after(function(done) {
          deleteSubmissions(submissions, done);
        });
      });

      describe('Self Assignment', function() {
        before(function() {
          submissions = [];
        });

        it('Create the group resource assignment action', function(done) {

        });

        it('A submission to the user resource, will create a user with new a group role', function(done) {

        });

        // @TODO: Finish permission check
        //it('A user can not assign group access that they do not have access to via the self user', function(done) {
        //
        //});
      });
    });

    describe('Submissions', function() {
      var form = null;
      var group = null;
      var submission = [];

      describe('Bootstrap', function() {
        it('Create the form', function(done) {

        });

        it('Create the group', function(done) {

        });

        it('Create the submission', function(done) {

        });
      });

      describe('read access', function() {
        before(function(done) {
          // Clear the submission group access
        });

        it('A user without group access, should not be able to read a submission', function(done) {

        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {

        });

        it('A user without group access, should not be able to update a submission', function(done) {

        });

        it('A user without group access, should not be able to delete a submission', function(done) {

        });

        it('An Administrative user can grant read access for the group', function(done) {

        });

        it('A user with group access, should be able to read a submission', function(done) {

        });

        it('A user with group access, should be able to read a submission through the index', function(done) {

        });

        it('A user with group access, should not be able to update a submission', function(done) {

        });

        it('A user with group access, should not be able to delete a submission', function(done) {

        });
      });

      describe('write access', function() {
        before(function(done) {
          // Clear the submission group access
        });

        it('A user without group access, should not be able to read a submission', function(done) {

        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {

        });

        it('A user without group access, should not be able to update a submission', function(done) {

        });

        it('A user without group access, should not be able to delete a submission', function(done) {

        });

        it('An Administrative user can grant write access for the group', function(done) {

        });

        it('A user with group access, should be able to read a submission', function(done) {

        });

        it('A user with group access, should be able to read a submission through the index', function(done) {

        });

        it('A user with group access, should be able to update a submission', function(done) {

        });

        it('A user with group access, should not be able to delete a submission', function(done) {

        });
      });

      describe('admin access', function() {
        before(function(done) {
          // Clear the submission group access
        });

        it('A user without group access, should not be able to read a submission', function(done) {

        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {

        });

        it('A user without group access, should not be able to update a submission', function(done) {

        });

        it('A user without group access, should not be able to delete a submission', function(done) {

        });

        it('An Administrative user can grant admin access for the group', function(done) {

        });

        it('A user with group access, should be able to read a submission', function(done) {

        });

        it('A user with group access, should be able to read a submission through the index', function(done) {

        });

        it('A user with group access, should be able to update a submission', function(done) {

        });

        it('A user with group access, should be able to delete a submission', function(done) {

        });
      });
    });
  });
};