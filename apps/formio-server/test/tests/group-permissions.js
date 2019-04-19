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
        groupAssignment: null,
        selfAssignment: null
      };
      var submissions = [];
      var group = {
        read: null,
        write: null,
        admin: null,
        none: null
      };

      describe('Bootstrap', function() {
        it('Create the input form', function(done) {
          form.input = {
            title: 'form',
            name: chance.word(),
            path: chance.word(),
            type: 'form',
            access: [],
            submissionAccess: [
              {
                type: 'create_all',
                roles: [
                  template.roles.authenticated._id
                ]
              }
            ],
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
              },
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
                placeholder: 'group',
                key: 'group',
                label: 'group',
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

        it('Create the self resource assignment action', function(done) {
          action.selfAssignment = {
            title: 'Self Assignment',
            name: 'group',
            handler: ['after'],
            method: ['create'],
            settings: {
              group: 'group'
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/action')
            .set('x-jwt-token', template.users.admin.token)
            .send(action.selfAssignment)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
              assert.equal(response.title, action.selfAssignment.title);
              assert.equal(response.name, action.selfAssignment.name);
              assert.deepEqual(response.handler, action.selfAssignment.handler);
              assert.deepEqual(response.method, action.selfAssignment.method);
              assert.deepEqual(response.settings, action.selfAssignment.settings);
              assert.equal(response.form, form.input._id);
              action.selfAssignment = response;

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
              },
              {
                "defaultPermission": "read",
                "conditional": {
                  "eq": "",
                  "when": null,
                  "show": ""
                },
                "tags": [],
                "type": "select",
                "validate": {
                  "required": false
                },
                "clearOnHide": true,
                "hidden": false,
                "persistent": true,
                "unique": false,
                "protected": false,
                "multiple": false,
                "template": "<span>{{ item.label }}</span>",
                "authenticate": false,
                "filter": "",
                "refreshOn": "",
                "defaultValue": "",
                "valueProperty": "",
                "dataSrc": "url",
                "data": {
                  "project": "",
                  "custom": "",
                  "resource": "",
                  "url": "http://myfake.com/nothing",
                  "json": "",
                  "values": []
                },
                "placeholder": "",
                "key": "readPerm",
                "label": "Read Field",
                "tableView": true,
                "input": true
              },
              {
                "defaultPermission": "write",
                "conditional": {
                  "eq": "",
                  "when": null,
                  "show": ""
                },
                "tags": [],
                "type": "select",
                "validate": {
                  "required": false
                },
                "clearOnHide": true,
                "hidden": false,
                "persistent": true,
                "unique": false,
                "protected": false,
                "multiple": false,
                "template": "<span>{{ item.label }}</span>",
                "authenticate": false,
                "filter": "",
                "refreshOn": "",
                "defaultValue": "",
                "valueProperty": "",
                "dataSrc": "url",
                "data": {
                  "project": "",
                  "custom": "",
                  "resource": "",
                  "url": "http://myfake.com/nothing",
                  "json": "",
                  "values": []
                },
                "placeholder": "",
                "key": "writePerm",
                "label": "Write Field",
                "tableView": true,
                "input": true
              },
              {
                "defaultPermission": "admin",
                "conditional": {
                  "eq": "",
                  "when": null,
                  "show": ""
                },
                "tags": [],
                "type": "select",
                "validate": {
                  "required": false
                },
                "clearOnHide": true,
                "hidden": false,
                "persistent": true,
                "unique": false,
                "protected": false,
                "multiple": false,
                "template": "<span>{{ item.label }}</span>",
                "authenticate": false,
                "filter": "",
                "refreshOn": "",
                "defaultValue": "",
                "valueProperty": "",
                "dataSrc": "url",
                "data": {
                  "project": "",
                  "custom": "",
                  "resource": "",
                  "url": "http://myfake.com/nothing",
                  "json": "",
                  "values": []
                },
                "placeholder": "",
                "key": "adminPerm",
                "label": "Admin Field",
                "tableView": true,
                "input": true
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
            submissionAccess: [
              {
                type: 'create_own',
                roles: [
                  template.roles.authenticated._id
                ]
              }
            ],
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
            });
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
              assert.equal(response.title, action.groupAssignment.title);
              assert.equal(response.name, action.groupAssignment.name);
              assert.deepEqual(response.handler, action.groupAssignment.handler);
              assert.deepEqual(response.method, action.groupAssignment.method);
              assert.deepEqual(response.settings, action.groupAssignment.settings);
              assert.equal(response.form, resource.groupUser._id);
              action.groupAssignment = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create a group w/ read access permissions', function(done) {
          group.read = {
            data: {
              name: 'Group1',
              readPerm: template.users.user1
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send(group.read)
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
              name: 'Group2',
              writePerm: template.users.user1
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send(group.write)
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
              name: 'Group3',
              adminPerm: template.users.user1
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send(group.admin)
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
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.group._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send(group.none)
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
      });

      // TODO: Add tests to verify that only valid groups can be assigned.
      describe('Group Resource Assignment', function() {
        before(function() {
          submissions = [];
        });

        it('A submission to the group user proxy will not assign group access with no resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + resource.groupUser._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
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
            .post('/project/' + template.project._id + '/form/' + resource.groupUser._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
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
            .post('/project/' + template.project._id + '/form/' + resource.groupUser._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
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
            .post('/project/' + template.project._id + '/form/' + resource.groupUser._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
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
          deleteForms([resource.groupUser], function() {
            deleteSubmissions(submissions, done);
          });
        });
      });

      // TODO: Add tests to verify that only valid groups can be assigned.
      describe('Self Assignment', function() {
        before(function() {
          submissions = [];
        });

        it('A submission to the form will not assign group access with no resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.none._id
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

        it('A submission to the form will not assign group access with read resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.read._id
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

        it('A submission to the form will assign group access with write resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.write._id
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

        it('A submission to the form will assign group access with write resource permissions', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form.input._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.admin._id
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
      });
    });

    describe('Submissions', function() {
      var form = null;
      var assignForm = null;
      var assignAction = null;
      var groupResource = null;
      var group = null;
      var submissions = [];

      describe('Bootstrap', function() {
        it('Create the form', function(done) {
          form = {
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
              },
              {
                "defaultPermission": "read",
                "conditional": {
                  "eq": "",
                  "when": null,
                  "show": ""
                },
                "tags": [],
                "type": "select",
                "validate": {
                  "required": false
                },
                "clearOnHide": true,
                "hidden": false,
                "persistent": true,
                "unique": false,
                "protected": false,
                "multiple": false,
                "template": "<span>{{ item.label }}</span>",
                "authenticate": false,
                "filter": "",
                "refreshOn": "",
                "defaultValue": "",
                "valueProperty": "",
                "dataSrc": "url",
                "data": {
                  "project": "",
                  "custom": "",
                  "resource": "",
                  "url": "http://myfake.com/nothing",
                  "json": "",
                  "values": []
                },
                "placeholder": "",
                "key": "readPerm",
                "label": "Read Field",
                "tableView": true,
                "input": true
              },
              {
                "defaultPermission": "write",
                "conditional": {
                  "eq": "",
                  "when": null,
                  "show": ""
                },
                "tags": [],
                "type": "select",
                "validate": {
                  "required": false
                },
                "clearOnHide": true,
                "hidden": false,
                "persistent": true,
                "unique": false,
                "protected": false,
                "multiple": false,
                "template": "<span>{{ item.label }}</span>",
                "authenticate": false,
                "filter": "",
                "refreshOn": "",
                "defaultValue": "",
                "valueProperty": "",
                "dataSrc": "url",
                "data": {
                  "project": "",
                  "custom": "",
                  "resource": "",
                  "url": "http://myfake.com/nothing",
                  "json": "",
                  "values": []
                },
                "placeholder": "",
                "key": "writePerm",
                "label": "Write Field",
                "tableView": true,
                "input": true
              },
              {
                "defaultPermission": "admin",
                "conditional": {
                  "eq": "",
                  "when": null,
                  "show": ""
                },
                "tags": [],
                "type": "select",
                "validate": {
                  "required": false
                },
                "clearOnHide": true,
                "hidden": false,
                "persistent": true,
                "unique": false,
                "protected": false,
                "multiple": false,
                "template": "<span>{{ item.label }}</span>",
                "authenticate": false,
                "filter": "",
                "refreshOn": "",
                "defaultValue": "",
                "valueProperty": "",
                "dataSrc": "url",
                "data": {
                  "project": "",
                  "custom": "",
                  "resource": "",
                  "url": "http://myfake.com/nothing",
                  "json": "",
                  "values": []
                },
                "placeholder": "",
                "key": "adminPerm",
                "label": "Admin Field",
                "tableView": true,
                "input": true
              }
            ]
          };

          request(app)
            .post('/project/' + template.project._id + '/form')
            .set('x-jwt-token', template.users.admin.token)
            .send(form)
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
              assert.equal(response.title, form.title);
              assert.equal(response.name, form.name);
              assert.equal(response.path, form.path);
              assert.equal(response.type, form.type);
              assert.deepEqual(response.submissionAccess, form.submissionAccess);
              assert.deepEqual(response.components, form.components);

              form = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create the group resource', function(done) {
          groupResource = {
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
            .send(groupResource)
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
              assert.equal(response.title, groupResource.title);
              assert.equal(response.name, groupResource.name);
              assert.equal(response.path, groupResource.path);
              assert.equal(response.type, groupResource.type);
              assert.deepEqual(response.submissionAccess, groupResource.submissionAccess);
              assert.deepEqual(response.components, groupResource.components);
              groupResource = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create the group', function(done) {
          group = {
            data: {
              name: chance.word()
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + groupResource._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send(group)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              group = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create the group assignment form', function(done) {
          assignForm = {
            title: 'assignForm',
            name: chance.word(),
            path: chance.word(),
            type: 'form',
            access: [],
            submissionAccess: [
              {
                type: 'create_all',
                roles: [
                  template.roles.administrator._id
                ]
              }
            ],
            components: [
              {
                input: true,
                tableView: true,
                label: 'Group',
                key: 'group',
                placeholder: '',
                resource: groupResource,
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
            .send(assignForm)
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
              assert.equal(response.title, assignForm.title);
              assert.equal(response.name, assignForm.name);
              assert.equal(response.path, assignForm.path);
              assert.equal(response.type, assignForm.type);
              assert.deepEqual(response.submissionAccess, assignForm.submissionAccess);
              assert.deepEqual(response.components, assignForm.components);
              assignForm = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create the group assignment action', function(done) {
          assignAction = {
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
            .post('/project/' + template.project._id + '/form/' + assignForm._id + '/action')
            .set('x-jwt-token', template.users.admin.token)
            .send(assignAction)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
              assert.equal(response.title, assignAction.title);
              assert.equal(response.name, assignAction.name);
              assert.deepEqual(response.handler, assignAction.handler);
              assert.deepEqual(response.method, assignAction.method);
              assert.deepEqual(response.settings, assignAction.settings);
              assert.equal(response.form, assignForm._id);
              assignAction = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Assign the group to the user via submission', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + assignForm._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                user: template.users.user1,
                group: group
              }
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              userHasGroupRole(template.users.user1, group._id, done);
            });
        });
      });

      describe('read access', function() {
        before(function() {
          submissions = [];
        });

        var submission;
        it('Create a submission', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                foo: chance.word()
              }
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              submission = response;
              submissions.push(response);

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert(Array.isArray(res.body), 'The result should be an array');
              assert.equal(res.body.length, 0);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to update a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word()
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

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to change the owner of a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to delete a submission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('An Administrative user can grant read access for the group', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                readPerm: group
              }
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              var found = false;
              response.access.forEach(function(permission) {
                if (permission.type === 'read' && permission.resources.indexOf(group._id) !== -1) {
                  found = true;
                }
              });
              assert.equal(found, true);
              submission = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.data.foo, submission.data.foo);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission through the index', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            //.expect('Content-Type', /json/)
            //.expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              var found = false;
              assert(response instanceof Array);
              response.forEach(function(sub) {
                if (sub._id === submission._id) {
                  found = true;
                }
              });
              assert.equal(found, true);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should not be able to update a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word()
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

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should not be able to change the owner of a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should not be able to delete a submission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        after(function(done) {
          deleteSubmissions(submissions, done);
        });
      });

      describe('write access', function() {
        before(function() {
          submissions = [];
        });

        var submission;
        it('Create a submission', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                foo: chance.word()
              }
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              submission = response;
              submissions.push(response);

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert(Array.isArray(res.body), 'The result should be an array');
              assert.equal(res.body.length, 0);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to update a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word()
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

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to change the owner of a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to delete a submission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('An Administrative user can grant write access for the group', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                writePerm: group
              }
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              var found = false;
              response.access.forEach(function(permission) {
                if (permission.type === 'write' && permission.resources.indexOf(group._id) !== -1) {
                  found = true;
                }
              });
              assert.equal(found, true);
              submission = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.data.foo, submission.data.foo);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission through the index', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              var found = false;
              assert(response instanceof Array);
              response.forEach(function(sub) {
                if (sub._id === submission._id) {
                  found = true;
                }
              });
              assert.equal(found, true);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to update a submission', function(done) {
          submission.data.foo = chance.word();

          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.data.foo, submission.data.foo);
              response = submission;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should not be able to change the owner of a submission', function(done) {
          submission.owner = template.users.user2._id;
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.notEqual(response.owner, template.users.user1._id);
              assert.notEqual(response.owner, template.users.user2._id);
              submission = response;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should not be able to delete a submission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        after(function(done) {
          deleteSubmissions(submissions, done);
        });
      });

      describe('admin access', function() {
        before(function() {
          submissions = [];
        });

        var submission;
        it('Create a submission', function(done) {
          request(app)
            .post('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                foo: chance.word()
              }
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              submission = response;
              submissions.push(response);

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert(Array.isArray(res.body), 'The result should be an array');
              assert.equal(res.body.length, 0);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to update a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word()
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

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to change the owner of a submission', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to delete a submission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('An Administrative user can grant admin access for the group', function(done) {
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                adminPerm: group
              }
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              var found = false;
              response.access.forEach(function(permission) {
                if (permission.type === 'admin' && permission.resources.indexOf(group._id) !== -1) {
                  found = true;
                }
              });
              assert.equal(found, true);
              submission = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.data.foo, submission.data.foo);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission through the index', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/submission')
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              var found = false;
              assert(response instanceof Array);
              response.forEach(function(sub) {
                if (sub._id === submission._id) {
                  found = true;
                }
              });
              assert.equal(found, true);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to update a submission', function(done) {
          submission.data.foo = chance.word();

          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.data.foo, submission.data.foo);
              submission = response;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to change the owner of a submission', function(done) {
          submission.owner = template.users.user2._id;
          request(app)
            .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.owner, template.users.user2._id);
              submission = response;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to delete a submission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.deepEqual(response, {});

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        after(function(done) {
          deleteSubmissions(submissions, done);
        });
      });
    });

    describe('Join Resource Group Permissions', () => {
        let helper = new template.Helper(template.formio.owner);
        it('Should create all of the forms and resources needed', (done) => {
          helper
            .project()
            .plan('trial')
            .user('user', 'user1', {
              data: {
                email: 'user1@example.com',
                password: '123testing'
              }
            })
            .user('user', 'user2', {
              data: {
                email: 'user2@example.com',
                password: '123testing'
              }
            })
            .user('user', 'user3', {
              data: {
                email: 'user3@example.com',
                password: '123testing'
              }
            })
            .form({
              name: 'department',
              type: 'resource',
              components: [
                {
                  type: 'textfield',
                  label: 'Name',
                  key: 'name'
                }
              ],
              submissionAccess: [
                {
                  type: 'group',
                  permission: 'write'
                }
              ]
            })
            .submission('department', {
              data: {
                name: 'HR'
              }
            })
            .submission('department', {
              data: {
                name: 'IT'
              }
            })
            .submission('department', {
              data: {
                name: 'Sales'
              }
            })
            .resource('departmentuser', [
              {
                type: 'resource',
                key: 'user',
                resource: 'user'
              },
              {
                type: 'resource',
                key: 'department',
                resource: 'department'
              }
            ])
            .action('departmentuser', {
              data: {
                priority: 5,
                name: 'group',
                title: 'Group Assignment',
                settings: {
                  group: 'department',
                  user: 'user'
                },
                handler: ['after'],
                method: ['create'],
                condition: {},
                submit: true
              },
              state: 'submitted'
            })
            .form('departmentreport', [
              {
                type: 'resource',
                key: 'department',
                resource: 'department',
                defaultPermission: 'admin'
              },
              {
                type: 'textarea',
                key: 'notes',
                label: 'Notes'
              }
            ])
            .execute(function() {
              done();
            });
        });

        it('Should have added the department id to the write permission access', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
            .set('x-jwt-token', helper.owner.token)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              const writeAccess = _.find(res.body.access, {
                type: 'write'
              });

              assert(!!writeAccess, 'Must find the write access on the department');
              assert.equal(writeAccess.resources.length, 1);
              assert.equal(writeAccess.resources[0], helper.template.submissions.department[0]._id.toString());
              done();
            });
        });

        it('Should assign some users to the departments.', (done) => {
          helper
            .submission('departmentuser', {
              data: {
                user: helper.template.users.user1,
                department: helper.template.submissions.department[0]
              }
            })
            .submission('departmentuser', {
              data: {
                user: helper.template.users.user1,
                department: helper.template.submissions.department[1]
              }
            })
            .submission('departmentuser', {
              data: {
                user: helper.template.users.user2,
                department: helper.template.submissions.department[1]
              }
            })
            .submission('departmentreport', {
              data: {
                department: helper.template.submissions.department[0],
                notes: 'This is only for the HR department!'
              }
            })
            .submission('departmentreport', {
              data: {
                department: helper.template.submissions.department[1],
                notes: 'This is only for the IT department!'
              }
            })
            .execute(() => {
              done();
            });
        });

        it('Should have added the department roles to the users.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user1._id}`)
            .set('x-jwt-token', helper.owner.token)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert(res.body.roles.indexOf(helper.template.submissions.department[0]._id.toString()) !== -1, 'Must have the department id as a role.');
              assert(res.body.roles.indexOf(helper.template.submissions.department[1]._id.toString()) !== -1, 'Must have the department id as a role.');
              done();
            });
        });

        it('Should allow a user to read their own department record', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              done();
            });
        });

        it('Should not allow a user to read other department records', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[2]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              done();
            });
        });

        it('Should allow a user to update their own department record', (done) => {
          const dept2 = _.cloneDeep(helper.template.submissions.department[1]);
          dept2.data.name = 'IT2';
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[1]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .send(dept2)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.equal(res.body.data.name, 'IT2');
              done();
            });
        });

        it('Should let another user update the department record back.', (done) => {
          const dept2 = _.cloneDeep(helper.template.submissions.department[1]);
          dept2.data.name = 'IT';
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[1]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user2.token)
            .send(dept2)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.equal(res.body.data.name, 'IT');
              done();
            });
        });

        it('Should NOT let another user update a department they dont belong too.', (done) => {
          const dept1 = _.cloneDeep(helper.template.submissions.department[0]);
          dept1.data.name = 'HR2';
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user2.token)
            .send(dept1)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              done();
            });
        });

        it('Should NOT let any user delete a department they belong too.', (done) => {
          request(app)
            .delete(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              done();
            });
        });

        it('Should NOT let any user delete a department they belong too.', (done) => {
          request(app)
            .delete(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[1]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user2.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              done();
            });
        });

        it('Should NOT let any user delete a department they do not belong too.', (done) => {
          request(app)
            .delete(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user2.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              done();
            });
        });

        it('Should NOT let a user elevate permissions', (done) => {
          const dept1 = _.cloneDeep(helper.template.submissions.department[0]);
          const groupPerm = _.find(dept1.access, {
            type: 'write'
          });
          groupPerm.type = 'admin';
          groupPerm.resources.push(helper.template.users.user2._id);
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .send(dept1)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const writeAccess = _.find(res.body.access, {
                type: 'write'
              });
              assert(!!writeAccess, 'Should have found a write permission');
              assert.deepEqual(writeAccess.resources, [helper.template.submissions.department[0]._id.toString()]);
              assert(!_.find(res.body.access, {
                type: 'admin'
              }), 'Should NOT have found an admin permission');
              assert.equal(res.body.data.name, 'HR');
              done();
            });
        });

        it('Should not let the user update the form.', (done) => {
          const deptForm = _.cloneDeep(helper.template.forms.department);
          deptForm.title = 'Testing';
          request(app)
            .put(`/project/${helper.template.project._id}/department`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .send(deptForm)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should let an admin update the form to change permissions.', (done) => {
          const deptForm = _.cloneDeep(helper.template.forms.department);
          deptForm.submissionAccess = [
            {
              type: 'group',
              permission: 'read'
            }
          ];
          request(app)
            .put(`/project/${helper.template.project._id}/department`)
            .set('x-jwt-token', helper.owner.token)
            .send(deptForm)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              helper.template.forms.department = res.body;
              assert.equal(res.body.submissionAccess[0].type, 'group');
              assert.equal(res.body.submissionAccess[0].permission, 'read');
              done();
            });
        });

        let marketingDept = null
        it('Should let an admin create a new group', (done) => {
          request(app)
            .post(`/project/${helper.template.project._id}/department/submission`)
            .set('x-jwt-token', helper.owner.token)
            .send({
              data: {
                name: 'Marketing'
              }
            })
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              marketingDept = res.body;
              const readAccess = _.find(res.body.access, {
                type: 'read'
              });
              assert.deepEqual(readAccess, {
                type: 'read',
                resources: [res.body._id.toString()]
              });
              assert(!_.find(res.body.access, {
                type: 'write'
              }), 'Should not find write access');
              assert(!_.find(res.body.access, {
                type: 'admin'
              }), 'Should not find admin access');
              done();
            });
        });

        it('Should assign some users to the departments.', (done) => {
          request(app)
            .post(`/project/${helper.template.project._id}/departmentuser/submission`)
            .set('x-jwt-token', helper.owner.token)
            .send({
              data: {
                department: marketingDept,
                user: helper.template.users.user3
              }
            })
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should have added the marketingDept id to the user3 roles.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user3._id.toString()}`)
            .set('x-jwt-token', helper.owner.token)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert(res.body.roles.indexOf(marketingDept._id.toString()) !== -1, 'Should have the marketing dept role');
              done();
            });
        });

        it('Should allow user3 access to read the marketing department.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${marketingDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user3.token)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should NOT allow user1 access to read the marketing department.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${marketingDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should NOT allow user2 access to read the marketing department.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${marketingDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user2.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should NOT allow user3 access to update the marketing department.', (done) => {
          marketingDept.data.name = 'Marketing2';
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${marketingDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user3.token)
            .send(marketingDept)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              marketingDept.data.name = 'Marketing';
              done();
            });
        });

        it('Should NOT allow user1 access to update the marketing department.', (done) => {
          marketingDept.data.name = 'Marketing2';
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${marketingDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .send(marketingDept)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              marketingDept.data.name = 'Marketing';
              done();
            });
        });

        it('Should NOT allow user3 access to delete the marketing department.', (done) => {
          request(app)
            .delete(`/project/${helper.template.project._id}/department/submission/${marketingDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user3.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should NOT allow user1 access to delete the marketing department.', (done) => {
          request(app)
            .delete(`/project/${helper.template.project._id}/department/submission/${marketingDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should let an admin update the form to change permissions.', (done) => {
          const deptForm = _.cloneDeep(helper.template.forms.department);
          deptForm.submissionAccess = [
            {
              type: 'group',
              permission: 'admin'
            }
          ];
          request(app)
            .put(`/project/${helper.template.project._id}/department`)
            .set('x-jwt-token', helper.owner.token)
            .send(deptForm)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              helper.template.forms.department = res.body;
              assert.equal(res.body.submissionAccess[0].type, 'group');
              assert.equal(res.body.submissionAccess[0].permission, 'admin');
              done();
            });
        });

        let qaDept = null
        it('Should let an admin create a new group', (done) => {
          request(app)
            .post(`/project/${helper.template.project._id}/department/submission`)
            .set('x-jwt-token', helper.owner.token)
            .send({
              data: {
                name: 'QA'
              }
            })
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              qaDept = res.body;
              const access = _.find(res.body.access, {
                type: 'admin'
              });
              assert.deepEqual(access, {
                type: 'admin',
                resources: [res.body._id.toString()]
              });
              assert(!_.find(res.body.access, {
                type: 'read'
              }), 'Should not find read access');
              assert(!_.find(res.body.access, {
                type: 'write'
              }), 'Should not find write access');
              done();
            });
        });

        it('Should assign some users to the departments.', (done) => {
          request(app)
            .post(`/project/${helper.template.project._id}/departmentuser/submission`)
            .set('x-jwt-token', helper.owner.token)
            .send({
              data: {
                department: qaDept,
                user: helper.template.users.user3
              }
            })
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should have added the qaDept id to the user3 roles.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user3._id.toString()}`)
            .set('x-jwt-token', helper.owner.token)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert(res.body.roles.indexOf(marketingDept._id.toString()) !== -1, 'Should have the marketing dept role');
              assert(res.body.roles.indexOf(qaDept._id.toString()) !== -1, 'Should also have the qa dept role');
              done();
            });
        });

        it('Should allow user3 access to read the QA department.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${qaDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user3.token)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should NOT allow user1 access to read the QA department.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${qaDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should NOT allow user2 access to read the QA department.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/department/submission/${qaDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user2.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should allow user3 access to update the QA department.', (done) => {
          qaDept.data.name = 'QA2';
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${qaDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user3.token)
            .send(qaDept)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert.equal(res.body.data.name, 'QA2');
              done();
            });
        });

        it('Should NOT allow user1 access to update the marketing department.', (done) => {
          qaDept.data.name = 'QA';
          request(app)
            .put(`/project/${helper.template.project._id}/department/submission/${qaDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .send(qaDept)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              qaDept.data.name = 'QA';
              done();
            });
        });

        it('Should NOT allow user1 access to delete the QA department.', (done) => {
          request(app)
            .delete(`/project/${helper.template.project._id}/department/submission/${qaDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user1.token)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should allow user3 access to delete the QA department.', (done) => {
          request(app)
            .delete(`/project/${helper.template.project._id}/department/submission/${qaDept._id.toString()}`)
            .set('x-jwt-token', helper.template.users.user3.token)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Should have added the department roles to the users.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user2._id}`)
            .set('x-jwt-token', helper.owner.token)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert(res.body.roles.indexOf(helper.template.submissions.department[0]._id.toString()) === -1, 'Must have the department id as a role.');
              assert(res.body.roles.indexOf(helper.template.submissions.department[1]._id.toString()) !== -1, 'Must not have the department id as a role.');
              done();
            });
        });

        it('The department reports should have the correct access configurations.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/departmentreport/submission/${helper.template.submissions.departmentreport[0]._id}`)
            .set('x-jwt-token', helper.owner.token)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert.equal(res.body.access.length, 1);
              assert.equal(res.body.access[0].resources.length, 1);
              assert.equal(res.body.access[0].resources[0], helper.template.submissions.department[0]._id);
              done();
            });
        });

        it('The department reports should have the correct access configurations.', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/departmentreport/submission/${helper.template.submissions.departmentreport[1]._id}`)
            .set('x-jwt-token', helper.owner.token)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert.equal(res.body.access.length, 1);
              assert.equal(res.body.access[0].resources.length, 1);
              assert.equal(res.body.access[0].resources[0], helper.template.submissions.department[1]._id);
              done();
            });
        });

        it('Should allow user1 to see the reports from both departments.', (done) => {
          request(app)
            .get('/project/' + helper.template.project._id + '/departmentreport/submission')
            .set('x-jwt-token', helper.template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.length, 2);
              assert.equal(response[0].data.notes, 'This is only for the IT department!');
              assert.equal(response[1].data.notes, 'This is only for the HR department!');
              helper.template.users.user1.token = res.headers['x-jwt-token'];
              done();
            });
        });

        it('Should allow user2 to see the reports from one department.', (done) => {
          request(app)
            .get('/project/' + helper.template.project._id + '/departmentreport/submission')
            .set('x-jwt-token', helper.template.users.user2.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.length, 1);
              assert.equal(response[0].data.notes, 'This is only for the IT department!');
              helper.template.users.user1.token = res.headers['x-jwt-token'];
              done();
            });
        });
      });
  });
};
