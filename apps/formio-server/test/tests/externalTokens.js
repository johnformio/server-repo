/* eslint-env mocha */
'use strict';

let request = require('supertest');
let assert = require('assert');
let jwt = require('jsonwebtoken');
const _ = require('lodash');
let config = require('../../config');
let docker = process.env.DOCKER;
let tempRole = '';
let tempRole2 = '';
let tempRole3 = '000000000000000000000001';

module.exports = (app, template, hook) => {
  if (docker) {
    // No docker tests.
    return;
  }
  let Helper = require('formio/test/helper')(app);

  describe('External Tokens', () => {
    let tempProject;
    let tempForm;
    let tempSubmission;
    let customToken;
    let badToken;
    let helper = new Helper(template.formio.owner, _.cloneDeep(template));

    before(done => {
      helper
        .project({
          title: 'External Tokens',
          name: 'externaltokens'
        })
        .role({
          title: 'external1'
        })
        .role({
          title: 'external2'
        })
        .execute((err) => {
          if (err) {
            return done(err);
          }

          tempRole = helper.template.roles.external1._id.toString();
          tempRole2 = helper.template.roles.external2._id.toString();
          customToken = app.formio.formio.auth.getToken({
            external: true,
            project: {
              _id: helper.template.project._id.toString()
            },
            user: {
              roles: [tempRole]
            }
          });
          badToken = app.formio.formio.auth.getToken({
            external: true,
            project: {
              _id: helper.template.project._id.toString()
            },
            user: {
              roles: [tempRole3]
            }
          });
          return done();
        });
    });

    it('Create a temporary form for external token tests', done => {
      helper
        .form('externalToken', [
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
        ])
        .execute((err, results) => {
          if (err) {
            return done(err);
          }

          tempProject = helper.template.project;
          tempForm = results.getForm('externalToken');

          request(app)
            .put(hook.alter(`url`, `/form/${tempForm._id}`, helper.template))
            .set(`x-jwt-token`, helper.template.formio.owner.token)
            .send({
              access: [
                {type: 'read_all', roles: [tempRole, tempRole2, tempRole3]},
              ],
              submissionAccess: [
                {type: 'read_all', roles: [tempRole]},
                {type: 'create_own', roles: [tempRole2]},
                {type: 'update_own', roles: [tempRole2]},
                {type: 'read_own', roles: [tempRole2]},
                {type: 'delete_own', roles: [tempRole2]}
              ]
            })
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              let response = res.body;
              tempForm = response;
              return done();
            });
        });
    });

    it('Create a temporary submission for external token tests', done => {
      helper
        .submission(`externalToken`, {
          foo: 'bar'
        })
        .execute((err, response) => {
          if (err) {
            return done(err);
          }

          tempSubmission = response.getLastSubmission();
          return done();
        });
    });

    it('An anonymous user cannot access the form without access', done => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}`, helper.template))
        .expect(401)
        .end(err => {
          if (err) {
            return done(err);
          }

          return done();
        });
    });

    it('A user with a token with a bad role cannot have access even if the role is added to the permission', done => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}`, helper.template))
        .set(`x-jwt-token`, badToken)
        .expect(401)
        .end(err => {
          if (err) {
            return done(err);
          }

          return done();
        });
    });

    it('A user with a custom token can access the form with access', done => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}`, helper.template))
        .set(`x-jwt-token`, customToken)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          let response = res.body;
          assert.equal(response.name, `externalToken`);
          assert(response.components);
          assert.equal(response.components.length, 1);
          assert.equal(response.access.length, 1);
          assert.deepEqual(response.access[0], {type: 'read_all', roles: [tempRole, tempRole2, tempRole3]});
          assert.equal(response.submissionAccess.length, 5);
          assert.deepEqual(response.submissionAccess[0], {type: 'read_all', roles: [tempRole]});
          return done();
        });
    });

    it('An anonymous user cannot access the submission without access', done => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`, helper.template))
        .expect(401)
        .end(err => {
          if (err) {
            return done(err);
          }

          return done();
        });
    });

    it('A user with a custom token can access the submission with access', done => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`, helper.template))
        .set(`x-jwt-token`, customToken)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          let response = res.body;
          assert(response.data);
          assert.equal(response.data.foo, 'bar');
          return done();
        });
    });

    describe('External Authentication', () => {
      let authToken;
      let payload;
      let submission;

      before('Create an external authorized token', done => {
        payload = {
          external: true,
          user: {
            _id: 'abc123',
            data: {
              firstName: 'Foo',
              lastName: 'Bar'
            },
            roles: [tempRole2]
          },
          form: {
            _id: tempForm._id
          },
          project: {
            _id: tempProject._id
          },
          externalToken: 'Some external token'
        };

        authToken = app.formio.formio.auth.getToken(payload);
        done();
      });

      it('Allows external auth tokens to create submissions', done => {
        const data = {
          foo: 'bart'
        };
        request(app)
          .post('/project/' + tempProject._id + '/form/' + tempForm._id + '/submission')
          .set('x-jwt-token', authToken)
          .send({data})
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            assert.deepEqual(data, res.body.data);
            assert.equal(payload.user._id, res.body.owner);

            submission = res.body;

            done();
          });
      });

      it('Allows external auth tokens to update submissions', done => {
        const data = {
          foo: 'baz'
        };
        request(app)
          .put('/project/' + tempProject._id + '/form/' + tempForm._id + '/submission/' + submission._id)
          .set('x-jwt-token', authToken)
          .send({data})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            assert.deepEqual(data, res.body.data);
            assert.equal(payload.user._id, res.body.owner);

            submission = res.body;

            done();
          });
      });

      it('Allows external auth tokens to export submissions', done => {
        request(app)
          .get('/project/' + tempProject._id + '/form/' + tempForm._id + '/export')
          .set('x-jwt-token', authToken)
          .send()
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            assert.equal(1, res.body.length);
            assert.equal(submission._id, res.body[0]._id);

            done();
          });
      });

      it('Allows external auth tokens to delete submissions', done => {
        request(app)
          .delete('/project/' + tempProject._id + '/form/' + tempForm._id + '/submission/' + submission._id)
          .set('x-jwt-token', authToken)
          .send()
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
    });

    describe('External Authentication with primary admin role', () => {
      let adminAuthToken;
      let authenticatedAuthToken;

      before('Create an external authoried token with primary admin role', done => {
        const payload = {
          external: true,
          user: {
            _id: 'abc123',
            data: {
              firstName: 'Foo',
              lastName: 'Bar'
            },
            roles: [tempRole2]
          },
          form: {
            _id: tempForm._id
          },
          project: {
            _id: template.formio.primary._id
          },
          externalToken: 'Some external token'
        };

        adminAuthToken = app.formio.formio.auth.getToken({
          ...payload,
          user: {
            ...payload.user,
            roles: [...payload.user.roles, template.formio.roles.administrator._id],
          },
        });
        authenticatedAuthToken = app.formio.formio.auth.getToken({
          ...payload,
          user: {
            ...payload.user,
            roles: [...payload.user.roles, template.formio.roles.authenticated._id],
          },
        });
        done();
      });

      it('Current endpoint should return admin flag for primary admin with external token', done => {
        request(app)
          .get('/current')
          .set('x-jwt-token', adminAuthToken)
          .send()
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.isAdmin, true);

            done();
          });
      });

      it('Current endpoint should not return admin flag for non primary admin with external token', done => {
        request(app)
          .get('/current')
          .set('x-jwt-token', authenticatedAuthToken)
          .send()
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.isAdmin, false);

            done();
          });
      });
    })
  });
};
