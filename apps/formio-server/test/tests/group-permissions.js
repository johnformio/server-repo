/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const async = require('async');
const chance = new (require('chance'))();

module.exports = (app, template, hook) => {
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
    describe('Classic Mode', () => {
      let form = null;
      let assignForm = null;
      let assignAction = null;
      let groupResource = null;
      let group = null;
      let submissions = [];

      const splitRolesCases = {
        anonymous: 'case for anonymous',
        authenticated: 'case for authenticated'
      }

      describe('Bootstrap', () => {
        it('Create the form', (done) => {
          form = {
            title: "form",
            name: chance.word(),
            path: chance.word(),
            type: "form",
            access: [],
            submissionAccess: [],
            components: [
              {
                type: "textfield",
                key: "foo",
                label: "foo",
                input: true,
              },
              {
                defaultPermission: "read",
                type: "select",
                dataSrc: "url",
                data: {
                  url: "http://myfake.com/nothing",
                },
                key: "readPerm",
                label: "Read Field",
                input: true,
              },
              {
                defaultPermission: "write",
                type: "select",
                dataSrc: "url",
                data: {
                  url: "http://myfake.com/nothing",
                },
                key: "writePerm",
                label: "Write Field",
                input: true,
              },
              {
                defaultPermission: "admin",
                type: "select",
                dataSrc: "url",
                data: {
                  url: "http://myfake.com/nothing",
                },
                key: "adminPerm",
                label: "Admin Field",
                input: true,
              },
            ],
            fieldMatchAccess: {
              read: [
                {
                  formFieldPath: "data.foo",
                  valueType: "string",
                  value:  splitRolesCases.anonymous,
                  operator: "$eq",
                  roles: [template.roles.anonymous._id],
                },
              ],
              create: [
                {
                  formFieldPath: "",
                  valueType: "string",
                  value: "",
                  operator: "$eq",
                  roles: [],
                },
              ],
              update: [
                {
                  formFieldPath: "data.foo",
                  valueType: "string",
                  value:  splitRolesCases.authenticated,
                  operator: "$eq",
                  roles: [template.roles.authenticated._id],
                },
              ],
              delete: [
                {
                  formFieldPath: "data.foo",
                  valueType: "string",
                  value:  splitRolesCases.authenticated,
                  operator: "$eq",
                  roles: [template.roles.authenticated._id],
                },
              ],
              write: [
                {
                  formFieldPath: "",
                  valueType: "string",
                  value: "",
                  operator: "$eq",
                  roles: [],
                },
              ],
              admin: [
                {
                  formFieldPath: "",
                  valueType: "string",
                  value: "",
                  operator: "$eq",
                  roles: [],
                },
              ],
            },
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
                key: 'name',
                label: 'name',
                input: true,
              },
            ],
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
              name: chance.word(),
            },
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
                  template.roles.administrator._id,
                ],
              },
            ],
            components: [
              {
                input: true,
                label: 'Group',
                key: 'group',
                resource: groupResource,
                type: 'resource',
              },
              {
                input: true,
                label: 'User',
                key: 'user',
                resource: template.users.user1.form,
                type: 'resource',
              },
            ],
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
            method: ['create', 'update', 'delete'],
            settings: {
              group: 'group',
              user: 'user',
            },
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
                group,
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

      describe('no access', () => {
        before(() => {
          submissions = [];
        });

        let submission;

        const updateSubmission = (value, next) => {
          request(app)
          .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
          .set('x-jwt-token', template.users.admin.token)
          .send({
            data: {
              foo: value,
            },
          })
          .end((err, res) => {
            if (err) {
              return next(err);
            }

            submission = res.body;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];
            next();
          });
        };

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

              updateSubmission(splitRolesCases.anonymous, done);
            });
        });

        it('A user with split roles access, should be able to read a submission', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body, submission);
              updateSubmission(chance.word(), done);
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

              updateSubmission(splitRolesCases.authenticated, done);
            });
        });

        it('A user with split roles access, should be able to read a submission through the index', (done) => {
          request(app)
            .get(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.user1.token)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert(Array.isArray(res.body), 'The result should be an array');
              assert.equal(res.body.length, 1);

              // Store the JWT for future API calls.
              template.users.user1.token = res.headers['x-jwt-token'];

              updateSubmission(chance.word(), done);
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

              updateSubmission(splitRolesCases.authenticated, done);
            });
        });

        it('A user with split role access, should be able to update a submission', (done) => {
          const value = chance.word();
          request(app)
            .put(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .send({
              data: {
                foo: value,
              },
            })
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.deepEqual(res.body.data.foo, value);

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

              updateSubmission(splitRolesCases.authenticated, done);
            });
        });


        it('A user with split roles access, should be able to delete a submission', (done) => {
          request(app)
            .delete(`/project/${template.project._id}/form/${form._id}/submission/${submission._id}`)
            .set('x-jwt-token', template.users.user1.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

               // Store the JWT for future API calls.
               template.users.user1.token = res.headers['x-jwt-token'];

              done();
            });
        });

        after((done) => {
          deleteSubmissions(submissions, done);
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
                readPerm: group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert(response.access.find((permission) => ((permission.type === 'read') && permission.resources.includes(group._id))));
              submission = response;
              submissions.push(response);

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
              assert(Array.isArray(response));
              assert(response.find((sub) => (sub._id === submission._id)));

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
                writePerm: group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert(response.access.find((permission) => ((permission.type === 'write') && permission.resources.includes(group._id))));
              submission = response;
              submissions.push(response);

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
              assert(Array.isArray(response));
              assert(response.find((sub) => (sub._id === submission._id)));

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
              submission = response;

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
                adminPerm: group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert(response.access.find((permission) => ((permission.type === 'admin') && permission.resources.includes(group._id))));
              submission = response;
              submissions.push(response);

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
              assert(Array.isArray(response));
              assert(response.find((sub) => (sub._id === submission._id)));

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

    describe('Levels', () => {
      let form = null;
      let assignForm = null;
      let assignAction = null;
      let groupResource = null;
      let group = null;
      let submission;
      let groupUser = null;

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
                key: 'foo',
                label: 'foo',
                input: true,
              },
              {
                submissionAccess: [
                  {
                    type: 'read',
                    roles: ['readRole'],
                  },
                  {
                    type: 'write',
                    roles: ['writeRole'],
                  },
                  {
                    type: 'admin',
                    roles: ['adminRole'],
                  },
                ],
                type: 'select',
                dataSrc: 'url',
                data: {
                  url: 'http://myfake.com/nothing',
                },
                key: 'group',
                label: 'Group',
                input: true,
              },
            ],
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
                key: 'name',
                label: 'name',
                input: true,
              },
            ],
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
              name: chance.word(),
            },
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
                  template.roles.administrator._id,
                ],
              },
            ],
            components: [
              {
                input: true,
                label: 'Group',
                key: 'group',
                resource: groupResource,
                type: 'resource',
              },
              {
                input: true,
                label: 'User',
                key: 'user',
                resource: template.users.user1.form,
                type: 'resource',
              },
              {
                input: true,
                label: 'Role',
                key: 'role',
                type: 'textfield',
              },
            ],
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
            method: ['create', 'update', 'delete'],
            settings: {
              group: 'group',
              user: 'user',
              role: 'role',
            },
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

        it('Create a submission', (done) => {
          request(app)
            .post(`/project/${template.project._id}/form/${form._id}/submission`)
            .set('x-jwt-token', template.users.admin.token)
            .send({
              data: {
                foo: chance.word(),
                group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              assert.deepEqual(response.access, [
                {
                  type: 'read',
                  resources: [
                    `${group._id}:readRole`,
                  ],
                },
                {
                  type: 'write',
                  resources: [
                    `${group._id}:writeRole`,
                  ],
                },
                {
                  type: 'admin',
                  resources: [
                    `${group._id}:adminRole`,
                  ],
                },
              ]);
              submission = response;

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
                group,
              },
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              groupUser = response;

              userHasGroupRole(template.users.user1, group._id, done);
            });
        });
      });

      describe('no role', () => {
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
      });

      describe('inappropriate role', () => {
        it('Elevate user role', (done) => {
          groupUser.data.role = 'inappropriateRole';

          request(app)
            .put(`/project/${template.project._id}/form/${assignForm._id}/submission/${groupUser._id}`)
            .set('x-jwt-token', template.users.admin.token)
            .send(groupUser)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              groupUser = response;

              userHasGroupRole(template.users.user1, `${group._id}:inappropriateRole`, done);
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
      });

      describe('read role', () => {
        it('Elevate user role', (done) => {
          groupUser.data.role = 'readRole';

          request(app)
            .put(`/project/${template.project._id}/form/${assignForm._id}/submission/${groupUser._id}`)
            .set('x-jwt-token', template.users.admin.token)
            .send(groupUser)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              groupUser = response;

              userHasGroupRole(template.users.user1, `${group._id}:readRole`, done);
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
              assert(Array.isArray(response));
              assert(response.find((sub) => (sub._id === submission._id)));

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
      });

      describe('write role', () => {
        it('Elevate user role', (done) => {
          groupUser.data.role = 'writeRole';

          request(app)
            .put(`/project/${template.project._id}/form/${assignForm._id}/submission/${groupUser._id}`)
            .set('x-jwt-token', template.users.admin.token)
            .send(groupUser)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              groupUser = response;

              userHasGroupRole(template.users.user1, `${group._id}:writeRole`, done);
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
              assert(Array.isArray(response));
              assert(response.find((sub) => (sub._id === submission._id)));

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
              submission = response;

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
      });

      describe('admin role', () => {
        it('Elevate user role', (done) => {
          groupUser.data.role = 'adminRole';

          request(app)
            .put(`/project/${template.project._id}/form/${assignForm._id}/submission/${groupUser._id}`)
            .set('x-jwt-token', template.users.admin.token)
            .send(groupUser)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              const response = res.body;
              groupUser = response;

              userHasGroupRole(template.users.user1, `${group._id}:adminRole`, done);
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
              assert(Array.isArray(response));
              assert(response.find((sub) => (sub._id === submission._id)));

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
      });
    });
  });
};
