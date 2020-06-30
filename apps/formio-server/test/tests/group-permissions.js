/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const async = require('async');
const chance = new (require('chance'))();

module.exports = (app, template, hook) => {
  const deleteForms = (forms, next) => {
    async.each(forms, (item, cb) => {
      request(app)
        .delete(`${hook.alter('url', '/form', template)}/${item._id}`)
        .set('x-jwt-token', template.users.admin.token)
        .end((err, res) => {
          if (err) {
            return cb(err);
          }

          cb();
        });
    }, (err) => {
      if (err) {
        return next(err);
      }

      return next();
    });
  };

  const deleteSubmissions = (submissions, next) => {
    async.each(submissions, (item, cb) => {
      request(app)
        .delete(`${hook.alter('url', '/form', template)}/${item.form}/submission/${item._id}`)
        .set('x-jwt-token', template.users.admin.token)
        .end((err, res) => {
          if (err) {
            return cb(err);
          }

          cb();
        });
    }, (err) => {
      if (err) {
        return next(err);
      }

      return next();
    });
  };

  const userHasGroupRole = (user, role, done) => {
    // Check that the user had the role added to their user obj.
    request(app)
      .get(`/project/${template.project._id}/form/${user.form}/submission/${user._id}`)
      .set('x-jwt-token', user.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        const response = res.body;
        assert(response.roles.includes(role));

        done();
      });
  };

  describe('Group Permissions', () => {
    describe('Group Assignment Action', () => {
      const form = {
        input: null,
      };
      const resource = {
        group: null,
        groupUser: null,
      };
      const action = {
        groupAssignment: null,
        selfAssignment: null,
      };
      let submissions = [];
      const group = {
        read: null,
        write: null,
        admin: null,
        none: null,
      };

      describe('Bootstrap', () => {
        it('Create the input form', (done) => {
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
                  template.roles.authenticated._id,
                ],
              },
            ],
            components: [
              {
                type: 'textfield',
                validate: {
                  custom: '',
                  pattern: '',
                  maxLength: '',
                  minLength: '',
                  required: false,
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
                input: true,
              },
              {
                type: 'textfield',
                validate: {
                  custom: '',
                  pattern: '',
                  maxLength: '',
                  minLength: '',
                  required: false,
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
                input: true,
              },
            ],
          };

          request(app)
            .post(`/project/${template.project._id}/form`)
            .set('x-jwt-token', template.users.admin.token)
            .send(form.input)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create the self resource assignment action', (done) => {
          action.selfAssignment = {
            title: 'Self Assignment',
            name: 'group',
            handler: ['after'],
            method: ['create', 'update', 'delete'],
            settings: {
              group: 'group',
            },
          };

          request(app)
            .post(`/project/${template.project._id}/form/${form.input._id}/action`)
            .set('x-jwt-token', template.users.admin.token)
            .send(action.selfAssignment)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create the group resource', (done) => {
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
                  required: false,
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
                input: true,
              },
              {
                defaultPermission: 'read',
                conditional: {
                  eq: '',
                  when: null,
                  show: '',
                },
                tags: [],
                type: 'select',
                validate: {
                  required: false,
                },
                clearOnHide: true,
                hidden: false,
                persistent: true,
                unique: false,
                protected: false,
                multiple: false,
                template: '<span>{{ item.label }}</span>',
                authenticate: false,
                filter: '',
                refreshOn: '',
                defaultValue: '',
                valueProperty: '',
                dataSrc: 'url',
                data: {
                  project: '',
                  custom: '',
                  resource: '',
                  url: 'http://myfake.com/nothing',
                  json: '',
                  values: [],
                },
                placeholder: '',
                key: 'readPerm',
                label: 'Read Field',
                tableView: true,
                input: true,
              },
              {
                defaultPermission: 'write',
                conditional: {
                  eq: '',
                  when: null,
                  show: '',
                },
                tags: [],
                type: 'select',
                validate: {
                  required: false,
                },
                clearOnHide: true,
                hidden: false,
                persistent: true,
                unique: false,
                protected: false,
                multiple: false,
                template: '<span>{{ item.label }}</span>',
                authenticate: false,
                filter: '',
                refreshOn: '',
                defaultValue: '',
                valueProperty: '',
                dataSrc: 'url',
                data: {
                  project: '',
                  custom: '',
                  resource: '',
                  url: 'http://myfake.com/nothing',
                  json: '',
                  values: [],
                },
                placeholder: '',
                key: 'writePerm',
                label: 'Write Field',
                tableView: true,
                input: true,
              },
              {
                defaultPermission: 'admin',
                conditional: {
                  eq: '',
                  when: null,
                  show: '',
                },
                tags: [],
                type: 'select',
                validate: {
                  required: false,
                },
                clearOnHide: true,
                hidden: false,
                persistent: true,
                unique: false,
                protected: false,
                multiple: false,
                template: '<span>{{ item.label }}</span>',
                authenticate: false,
                filter: '',
                refreshOn: '',
                defaultValue: '',
                valueProperty: '',
                dataSrc: 'url',
                data: {
                  project: '',
                  custom: '',
                  resource: '',
                  url: 'http://myfake.com/nothing',
                  json: '',
                  values: [],
                },
                placeholder: '',
                key: 'adminPerm',
                label: 'Admin Field',
                tableView: true,
                input: true,
              }
            ],
          };

          request(app)
            .post(`/project/${template.project._id}/form`)
            .set('x-jwt-token', template.users.admin.token)
            .send(resource.group)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create the groupUser resource', (done) => {
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
                  template.roles.authenticated._id,
                ],
              },
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
                  required: false,
                },
                defaultPermission: '',
                type: 'resource',
                tags: [],
                conditional: {
                  show: '',
                  when: null,
                  eq: '',
                },
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
                  required: false,
                },
                defaultPermission: '',
                type: 'resource',
                tags: [],
                conditional: {
                  show: '',
                  when: null,
                  eq: '',
                },
              },
            ],
          };

          request(app)
            .post(`/project/${template.project._id}/form`)
            .set('x-jwt-token', template.users.admin.token)
            .send(resource.groupUser)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create the group resource assignment action', (done) => {
          action.groupAssignment = {
            title: 'Group Assignment',
            name: 'group',
            handler: ['after'],
            method: ['create', 'update', 'delete'],
            settings: {
              group: 'group',
              user: 'user',
            },
          };

          request(app)
            .post(`/project/${template.project._id}/form/${resource.groupUser._id}/action`)
            .set('x-jwt-token', template.users.admin.token)
            .send(action.groupAssignment)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create a group w/ read access permissions', (done) => {
          group.read = {
            data: {
              name: 'Group1',
              readPerm: template.users.user1,
            },
          };

          request(app)
            .post(`/project/${template.project._id}/form/${resource.group._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send(group.read)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              group.read = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create a group w/ write access permissions', (done) => {
          group.write = {
            data: {
              name: 'Group2',
              writePerm: template.users.user1,
            },
          };

          request(app)
            .post(`/project/${template.project._id}/form/${resource.group._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send(group.write)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              group.write = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create a group w/ admin access permissions', (done) => {
          group.admin = {
            data: {
              name: 'Group3',
              adminPerm: template.users.user1,
            },
          };

          request(app)
            .post(`/project/${template.project._id}/form/${resource.group._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send(group.admin)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              group.admin = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create a group w/ no access permissions', (done) => {
          group.none = {
            data: {
              name: 'Group4',
            },
          };

          request(app)
            .post(`/project/${template.project._id}/form/${resource.group._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send(group.none)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              group.none = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      // TODO: Add tests to verify that only valid groups can be assigned.
      describe('Group Resource Assignment', () => {
        before(() => {
          submissions = [];
        });

        it('A submission to the group user proxy will not assign group access with no resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${resource.groupUser._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                group: group.none._id,
                user: template.users.user1,
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              done()
            });
        });

        it('A submission to the group user proxy will not assign group access with read resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${resource.groupUser._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                group: group.read._id,
                user: template.users.user1,
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              done()
            });
        });

        it('A submission to the group user proxy will assign group access with write resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${resource.groupUser._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                group: group.write._id,
                user: template.users.user1,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              submissions.push(response);
              userHasGroupRole(template.users.user1, group.write._id, done);
            });
        });

        it('A submission to the group user proxy will assign group access with admin resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${resource.groupUser._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                group: group.admin._id,
                user: template.users.user1,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              submissions.push(response);
              userHasGroupRole(template.users.user1, group.admin._id, done);
            });
        });

        after((done) => {
          deleteForms([resource.groupUser], () => {
            deleteSubmissions(submissions, done);
          });
        });
      });

      // TODO: Add tests to verify that only valid groups can be assigned.
      describe('Self Assignment', () => {
        before(() => {
          submissions = [];
        });

        it('A submission to the form will not assign group access with no resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form.input._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.none._id,
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              done()
            });
        });

        it('A submission to the form will not assign group access with read resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form.input._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.read._id,
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, {});
              assert.equal(res.text, 'Unauthorized');

              done()
            });
        });

        it('A submission to the form will assign group access with write resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form.input._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.write._id,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              submissions.push(response);
              userHasGroupRole(template.users.user1, group.write._id, done);
            });
        });

        it('A submission to the form will assign group access with write resource permissions', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form.input._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
                group: group.admin._id,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              submissions.push(response);
              userHasGroupRole(template.users.user1, group.admin._id, done);
            });
        });
      });
    });

    describe('Submissions', () => {
      let form = null;
      let assignForm = null;
      let assignAction = null;
      let groupResource = null;
      let group = null;
      let submissions = [];

      describe('Bootstrap', () => {
        it('Create the form', (done) => {
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
            .post(`/project/${template.project._id}/form`)
            .set('x-jwt-token', template.users.admin.token)
            .send(form)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create the group resource', (done) => {
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
            .post(`/project/${template.project._id}/form`)
            .set('x-jwt-token', template.users.admin.token)
            .send(groupResource)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create the group', (done) => {
          group = {
            data: {
              name: chance.word()
            }
          };

          request(app)
            .post(`/project/${template.project._id}/form/${groupResource._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send(group)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              group = response;

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Create the group assignment form', (done) => {
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
            .post(`/project/${template.project._id}/form`)
            .set('x-jwt-token', template.users.admin.token)
            .send(assignForm)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Create the group assignment action', (done) => {
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
            .post(`/project/${template.project._id}/form/${assignForm._id}/action`)
            .set('x-jwt-token', template.users.admin.token)
            .send(assignAction)
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
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

        it('Assign the group to the user via submission', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${assignForm._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                user: template.users.user1,
                group: group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              userHasGroupRole(template.users.user1, group._id, done);
            });
        });
      });

      describe('read access', () => {
        before(() => {
          submissions = [];
        });

        let submission;
        it('Create a submission', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                foo: chance.word(),
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              submission = response;
              submissions.push(response);

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to read a submission through the index', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .expect(200)
            .end((err, res) => {
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

        it('A user without group access, should not be able to update a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to change the owner of a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id,
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to delete a submission', (done) => {
          request(app)
            .delete(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('An Administrative user can grant read access for the group', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                readPerm: group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              let found = false;
              response.access.forEach((permission) => {
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

        it('A user with group access, should be able to read a submission', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.equal(response.data.foo, submission.data.foo);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission through the index', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            //.expect('Content-Type', /json/)
            //.expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              let found = false;
              assert(response instanceof Array);
              response.forEach((sub) => {
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

        it('A user with group access, should not be able to update a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user with group access, should not be able to change the owner of a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id,
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user with group access, should not be able to delete a submission', (done) => {
          request(app)
            .delete(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        after((done) => {
          deleteSubmissions(submissions, done);
        });
      });

      describe('write access', () => {
        before(() => {
          submissions = [];
        });

        let submission;
        it('Create a submission', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                foo: chance.word(),
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              submission = response;
              submissions.push(response);

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to read a submission through the index', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .expect(200)
            .end((err, res) => {
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

        it('A user without group access, should not be able to update a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to change the owner of a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id,
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to delete a submission', (done) => {
          request(app)
            .delete(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('An Administrative user can grant write access for the group', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                writePerm: group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              let found = false;
              response.access.forEach((permission) => {
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

        it('A user with group access, should be able to read a submission', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.equal(response.data.foo, submission.data.foo);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission through the index', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              let found = false;
              assert(response instanceof Array);
              response.forEach((sub) => {
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

        it('A user with group access, should be able to update a submission', (done) => {
          submission.data.foo = chance.word();

          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              let response = res.body;
              assert.equal(response.data.foo, submission.data.foo);
              response = submission;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should not be able to change the owner of a submission', (done) => {
          submission.owner = template.users.user2._id;
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.notEqual(response.owner, template.users.user1._id);
              assert.notEqual(response.owner, template.users.user2._id);
              submission = response;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should not be able to delete a submission', (done) => {
          request(app)
            .delete(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        after((done) => {
          deleteSubmissions(submissions, done);
        });
      });

      describe('admin access', () => {
        before(() => {
          submissions = [];
        });

        let submission;
        it('Create a submission', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                foo: chance.word(),
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              submission = response;
              submissions.push(response);

              // Store the JWT for future API calls.
              template.users.admin.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user without group access, should not be able to read a submission', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to read a submission through the index', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .expect(200)
            .end((err, res) => {
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

        it('A user without group access, should not be able to update a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: chance.word(),
              },
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to change the owner of a submission', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              owner: template.users.user2._id,
            })
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('A user without group access, should not be able to delete a submission', (done) => {
          request(app)
            .delete(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /text/)
            .expect(401)
            .end((err, res) => {
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

        it('An Administrative user can grant admin access for the group', (done) => {
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                adminPerm: group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              let found = false;
              response.access.forEach((permission) => {
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

        it('A user with group access, should be able to read a submission', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.equal(response.data.foo, submission.data.foo);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to read a submission through the index', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              let found = false;
              assert(response instanceof Array);
              response.forEach((sub) => {
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

        it('A user with group access, should be able to update a submission', (done) => {
          submission.data.foo = chance.word();

          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.equal(response.data.foo, submission.data.foo);
              submission = response;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to change the owner of a submission', (done) => {
          submission.owner = template.users.user2._id;
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send(submission)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.equal(response.owner, template.users.user2._id);
              submission = response;

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A user with group access, should be able to delete a submission', (done) => {
          request(app)
            .delete(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.deepEqual(response, {});

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        after((done) => {
          deleteSubmissions(submissions, done);
        });
      });
    });
  });
};
