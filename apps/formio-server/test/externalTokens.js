/* eslint-env mocha */
'use strict';

let request = require('supertest');
let assert = require('assert');
let _ = require('lodash');
let async = require('async');
let jwt = require('jsonwebtoken');


module.exports = function(app, template, hook) {
  let Helper = require('formio/test/helper')(app);
  
  describe('External Tokens', function() {
    let tempForm;
    let tempSubmission;
    let customToken;
    let helper = new Helper(template.users.admin, template);

    before(function(done) {
      new Promise((resolve, reject) => {
        // Get the old token payload
        jwt.verify(template.users.user1.token, app.formio.formio.config.jwt.secret, (err, decoded) => {
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
        ], {
          access: [
            {type: 'read_all', roles: ['000000000000000000000000']}
          ],
          submissionAccess: [
            {type: 'read_all', roles: ['000000000000000000000000']}
          ]
        })
        .exec((err, results) => {
          if (err) {
            return done;
          }
          
          tempForm = results.getForm('externalToken');
          done();
        });
    });

    it('Create a temporary submission for external token tests', function(done) {
      helper
        .submission('externalToken', {
          foo: 'bar'
        })
        .exec((err, response) => {
          if (err) {
            return done(err);
          }

          tempSubmission = response.getLastSubmission();
          return done();
        });
    });

    it('An anonymous user cannot access the form without access', function(done) {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}`))
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
        .get(hook.alter(`url`, `/form/${tempForm._id}`))
        .set(`x-jwt-token`, customToken)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          let response = res.body;
          assert.equal(response.name, `customToken`);
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
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`))
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
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`))
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
