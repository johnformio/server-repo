/* eslint-env mocha */
'use strict';

let request = require('supertest');
let assert = require('assert');
let jwt = require('jsonwebtoken');
let config = require('../config');
let docker = process.env.DOCKER;

module.exports = function(app, template, hook) {
  if (docker) {
    // No docker tests.
    return;
  }
  let Helper = require('formio/test/helper')(app);
  
  describe('External Tokens', function() {
    let tempForm;
    let tempSubmission;
    let customToken;
    let helper = new Helper(template.formio.owner, template);

    before(function(done) {
      return new Promise((resolve, reject) => {
        // Get the old token payload
        jwt.verify(template.users.user1.token, config.formio.jwt.secret, (err, decoded) => {
          if (err) {
            return reject(err);
          }

          resolve(decoded);
        });
      })
      .then(payload => {
        // Add the external flag to the temp token.
        payload.external = true;
        payload.user.roles = [
          '000000000000000000000000'
        ];

        // Delete iat to forge generate a new token.
        delete payload.iat;

        // Generate the new custom token.
        customToken = app.formio.formio.auth.getToken(payload);
        return done();
      })
      .catch(done);
    });

    it('Create a temporary form for external token tests', function(done) {
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
            return done;
          }
          
          tempForm = results.getForm('externalToken');
          request(app)
            .put(hook.alter(`url`, `/form/${tempForm._id}`, template))
            .set(`x-jwt-token`, template.formio.owner.token)
            .send({
              access: [
                {type: 'read_all', roles: ['000000000000000000000000']}
              ],
              submissionAccess: [
                {type: 'read_all', roles: ['000000000000000000000000']}
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

    it('Create a temporary submission for external token tests', function(done) {
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

    it('An anonymous user cannot access the form without access', function(done) {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}`, template))
        .expect(401)
        .end(err => {
          if (err) {
            return done(err);
          }

          return done();
        });
    });

    it('A user with a custom token can access the form with access', function(done) {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}`, template))
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
          assert.deepEqual(response.access[0], {type: 'read_all', roles: ['000000000000000000000000']});
          assert.equal(response.submissionAccess.length, 1);
          assert.deepEqual(response.submissionAccess[0], {type: 'read_all', roles: ['000000000000000000000000']});
          return done();
        });
    });

    it('An anonymous user cannot access the submission without access', function(done) {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`, template))
        .expect(401)
        .end(err => {
          if (err) {
            return done(err);
          }

          return done();
        });
    });

    it('A user with a custom token can access the submission with access', function(done) {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`, template))
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
  });
};
