/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var Q = require('q');
var util = require('formio/src/util/util');
var docker = process.env.DOCKER;
const nock = require('nock');

nock('https://openidprovider-token.com').post('/token')
  .reply(200, () => {
    return {
      access_token: "eyJ0eXAiOiJKV1QiLCJub25jZSI6ImJvd3lraDFWQ2NkRUQ1NzZ4QTZWdFVoeEt5RFZUNDBESjZpMURieHJoNHMiLCJhbGciOiJSUzI1NiIsIng1dCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyIsImtpZCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyJ9.eyJhdWQiOiIwMDAwMDAwMy0wMDAwLTAwMDAtYzAwMC0wMDAwMDAwMDAwMDAiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC84YmUzYWUyNC02YzkwLTRmMzUtYWRhNy0zZWVkNGY3ZjcyMGMvIiwiaWF0IjoxNjIwOTE0NTY5LCJuYmYiOjE2MjA5MTQ1NjksImV4cCI6MTYyMDkxODQ2OSwiYWNjdCI6MCwiYWNyIjoiMSIsImFjcnMiOlsidXJuOnVzZXI6cmVnaXN0ZXJzZWN1cml0eWluZm8iLCJ1cm46bWljcm9zb2Z0OnJlcTEiLCJ1cm46bWljcm9zb2Z0OnJlcTIiLCJ1cm46bWljcm9zb2Z0OnJlcTMiLCJjMSIsImMyIiwiYzMiLCJjNCIsImM1IiwiYzYiLCJjNyIsImM4IiwiYzkiLCJjMTAiLCJjMTEiLCJjMTIiLCJjMTMiLCJjMTQiLCJjMTUiLCJjMTYiLCJjMTciLCJjMTgiLCJjMTkiLCJjMjAiLCJjMjEiLCJjMjIiLCJjMjMiLCJjMjQiLCJjMjUiXSwiYWlvIjoiQVVRQXUvOFRBQUFBNytJM2NvWUx0bjdiejdvM01LcytQQ1QzT0xNbUtJa3AyOHV6bVRGbEFhRlNQY1NWVGt2QkNhNG05TUtlZEdIU0R5WFZFYUwwU1Y4RnJmVXkxRDdVVXc9PSIsImFsdHNlY2lkIjoiMTpsaXZlLmNvbTowMDAzNDAwMTMzREMyRTIxIiwiYW1yIjpbInB3ZCJdLCJhcHBfZGlzcGxheW5hbWUiOiJGb3JtaW8gVGVzdCBBdXRoIiwiYXBwaWQiOiIxZWIwZjc4ZS1iYzU1LTQ5ODAtYWQ3My02ZTAwZDZiYmU0YWMiLCJhcHBpZGFjciI6IjEiLCJlbWFpbCI6Im1ha3NAZm9ybS5pbyIsImZhbWlseV9uYW1lIjoiRmFsZWkiLCJnaXZlbl9uYW1lIjoiTWFrc2ltIiwiaWRwIjoibGl2ZS5jb20iLCJpZHR5cCI6InVzZXIiLCJpcGFkZHIiOiI0Ni41My4yNDAuMTU0IiwibmFtZSI6Ik1ha3NpbSBGYWxlaSIsIm9pZCI6IjY3MzYyYzVmLTQ3NDAtNGU3Yy1iMjJhLTQ2NDg4OGUwZjMyMCIsInBsYXRmIjoiMyIsInB1aWQiOiIxMDAzMjAwMTNGREQ0QjlEIiwicmgiOiIwLkFZRUFKSzdqaTVCc05VLXRwejd0VDM5eURJNzNzQjVWdklCSnJYTnVBTmE3NUt5QkFNUS4iLCJzY3AiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCIsInN1YiI6IlR4OXc1VHVaTDM5VDBOU2VBaS1OZXdxVkJtZWF6YU9JX3VWR04tckZETnMiLCJ0ZW5hbnRfcmVnaW9uX3Njb3BlIjoiRVUiLCJ0aWQiOiI4YmUzYWUyNC02YzkwLTRmMzUtYWRhNy0zZWVkNGY3ZjcyMGMiLCJ1bmlxdWVfbmFtZSI6ImxpdmUuY29tI21ha3NAZm9ybS5pbyIsInV0aSI6Ii1fR1llT2NDeWs2MHZEako2WVRPQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjYyZTkwMzk0LTY5ZjUtNDIzNy05MTkwLTAxMjE3NzE0NWUxMCIsImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJ4bXNfc3QiOnsic3ViIjoiM0xDQy1EdzhpSzFrMmJWTFFMZVFjaHEwZTJfd2huVmtTaG9TZXJyVFZXRSJ9LCJ4bXNfdGNkdCI6MTYyMDgxMjMyMH0.KS9zVuFuk_HrDzbHROWU3DjDU_xGLEWvVdBGN_jyYlne84j5PMX5Mx6SWOrOsMWcUn8QRyia_9tFwDeypI9MV85K4nC3qE8JnltrLc-j2vPkhbqtGH3jLXQZn5fAJD4c6iepUyKCd1vlC4pBrudw7QCqIZevD1Pj5PbK3nEM9FZbGnVNUEdJabeGq8y0CH-U2-XeAd_GR6Iv9zq0_2w-s8ACpyPwRhOWnMESAiX02Cfj2DpagFHBKuJoEej6Tgpa5F7PSuM25CAU0vwnoaRYiIkbdjl9GvCQXS9xcDfZ48_K6BbTmJ1EJqBVlZOQ2LOEuSunLPDn9XM-whF7nuRrzg",
      expires_in: 3599,
      ext_expires_in: 3599,
      id_token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyJ9.eyJhdWQiOiIxZWIwZjc4ZS1iYzU1LTQ5ODAtYWQ3My02ZTAwZDZiYmU0YWMiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vOGJlM2FlMjQtNmM5MC00ZjM1LWFkYTctM2VlZDRmN2Y3MjBjL3YyLjAiLCJpYXQiOjE2MjA5MTQ1NjksIm5iZiI6MTYyMDkxNDU2OSwiZXhwIjoxNjIwOTE4NDY5LCJhaW8iOiJBV1FBbS84VEFBQUFUVkRtTFRwZnFlN0VCR0FjTEdEVjllYjNsdGZ0a0VnS3RLRnpjbEFLZFFPMWRnTmlWUFNYcXYxYlFHdTlWVVMvOE5TREpXQ2k1ZUs4U05YNzFyMzdwVVIyUTNtSEQveWRxbjB1MkxEaWF3Vk1MODBPOEk5Q0NlOGo5TlAzNytHVyIsImlkcCI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzkxODgwNDBkLTZjNjctNGM1Yi1iMTEyLTM2YTMwNGI2NmRhZC8iLCJyaCI6IjAuQVlFQUpLN2ppNUJzTlUtdHB6N3RUMzl5REk3M3NCNVZ2SUJKclhOdUFOYTc1S3lCQU1RLiIsInN1YiI6IjNMQ0MtRHc4aUsxazJiVkxRTGVRY2hxMGUyX3doblZrU2hvU2VyclRWV0UiLCJ0aWQiOiI4YmUzYWUyNC02YzkwLTRmMzUtYWRhNy0zZWVkNGY3ZjcyMGMiLCJ1dGkiOiItX0dZZU9jQ3lrNjB2RGpKNllUT0FBIiwidmVyIjoiMi4wIn0.jI3Bgvj4Bxh00KPwVEq5vus9ARRG3GJwUQ-byT92b8IfwfRf5g-6aSTZ2Qe5OV5RYcSVOv-c587naiz8kEOvgO6KuDCz1ObN-wCQpIzEVR_XkPiJoT11hoUYL9WwqmFzS1JSzMrI8FpV6_hAplz7HRqUYfVb_W1Cl7jZGaJt3Kl8AszmxUwRn83yRBe_ED-cSSZeD6IyeFeo09nxx8t1n-jmucWj3kt63lZdensZKaLGAecNn6WielW3WpOPKzv56qHx5xOpVnZnopV5bT0ILlRdaNb_zIcV2sG0bPZ_GhskpxI02oE98e435cGjOvvZKokpdlAo6iqf-Zgm93t7yQ",
      scope: "openid profile email",
      token_type: "Bearer"
    }
  });

module.exports = function(app, template, hook, eventEmitter) {
  // Cannot run these tests without access to formio instance
  if (docker) {
    return;
  }

  var ignoreFields = ['config', 'plan'];

  // Makes sure given user has external tokens match the expected ones
  // Does NOT fail if user has more tokens than expected ones
  // Returns a promise
  var checkExternalTokens = function(user, expected) {
    return app.formio.formio.resources.submission.model.findOne({_id: user._id})
    .then(function(user) {
      user = user.toObject();
      _.each(expected, function(expectedToken){
        var actualToken = _.find(user.externalTokens, {type: expectedToken.type});
        actualToken = _.omit(actualToken, '_id', 'modified', 'created');
        assert.deepEqual(actualToken, expectedToken, 'Submission should have expected externalToken of type ' + expectedToken.type);
      });
    });
  };

  describe('OAuth', function() {
    var oauthSettings = {
      oauth: {
        test1: {
          clientId: 'TESTCLIENTID1',
          clientSecret: 'TESTCLIENTSECRET1'
        },
        test2: {
          clientId: 'TESTCLIENTID2',
          clientSecret: 'TESTCLIENTSECRET2'
        },
        github: {
          clientId: 'TESTCLIENTIDGITHUB',
          clientSecret: 'TESTCLIENTSECRETGITHUB'
        },
        facebook: {
          clientId: 'TESTCLIENTIDFACEBOOK',
          clientSecret: 'TESTCLIENTSECRETFACEBOOK'
        },
        openid: {
          clientId: 'TEST_CLIENT_ID',
          clientSecret: 'TEST_CLIENT-SECRET',
          authURL: 'https://mydomain.com',
          userInfoURI: 'https://openIdProvider.com/userInfo.com',
          tokenURI: 'https://openidprovider-token.com/token',
        },
        oauthM2M: {
          clientId: 'TEST_CLIENT_ID',
          clientSecret: 'TEST_CLIENT-SECRET',
          tokenURI: 'https://m2mtoken.com/token',
        },
      },
    };

    var TEST_AUTH_CODE_1 = 'TESTAUTHCODE1';
    var TEST_ACCESS_TOKEN_1 = {
      type: 'test1',
      token: 'TESTACCESSTOKEN1',
      exp: new Date(Date.now() + 3600000)
    };
    var TEST_REDIRECT_URI_1 = 'http://client1.com';
    var TEST_USER_1 = {
      id: 23,
      email: 'user1@test1.com'
    };

    var TEST_AUTH_CODE_2 = 'TESTAUTHCODE2';
    var TEST_ACCESS_TOKEN_2 = {
      type: 'test2',
      token: 'TESTACCESSTOKEN2',
      exp: new Date(Date.now()) // Expires immediately to test refreshing
    };
    var REFRESHED_TEST_ACCESS_TOKEN_2 = {
      type: 'test2',
      token: 'REFRESHEDTESTACCESSTOKEN2',
      exp: new Date(Date.now() + 3600000)
    };
    var TEST_REDIRECT_URI_2 = 'http://client2.com';
    var TEST_USER_2 = {
      id: 42,
      email: 'user2@test2.com'
    };

    beforeEach(function() {
      // Update the expiration date, so every test has a unique token expiration
      // Needed to see if tokens are actually being updated
      TEST_ACCESS_TOKEN_1.exp = new Date(Date.now() + 3600000);
      TEST_ACCESS_TOKEN_2.exp = new Date(Date.now()); // Expires immediately to test refreshing

      // Create a dummy oauth provider
      app.formio.formio.oauth.providers.test1 = {
        name: 'test1',
        title: 'Test1',
        authURI: 'http://test1.com/oauth/authorize',
        scope: 'email',
        display: 'popup',
        autofillFields: [{
          title: 'Email',
          name: 'email'
        }],
        getTokens: function(req, code, state, redirectURI, next) {
          assert.equal(code, TEST_AUTH_CODE_1, 'OAuth Action should request access token with expected test code.');
          assert.equal(redirectURI, TEST_REDIRECT_URI_1, 'OAuth Action should request access token with expected redirect uri.');
          return new Q([TEST_ACCESS_TOKEN_1]).nodeify(next);
        },
        getUser: function(tokens, next) {
          assert.deepEqual(tokens, [TEST_ACCESS_TOKEN_1],
            'OAuth Action should request user info with expected test access token.');
          return new Q(TEST_USER_1).nodeify(next);
        },
        getUserId: function(user) {
          assert.deepEqual(user, TEST_USER_1, 'OAuth Action should get ID from expected test user.');
          return Promise.resolve(user.id);
        },
        getUserEmail: function(user) {
          assert.deepEqual(user, TEST_USER_1, 'OAuth Action should get ID from expected test user.');
          return Promise.resolve(user.email);
        },
      };

      // Create another dummy oauth provider
      app.formio.formio.oauth.providers.test2 = {
        name: 'test2',
        title: 'Test2',
        authURI: 'http://test2.com/oauth/authorize',
        scope: 'email',
        autofillFields: [{
          title: 'Email',
          name: 'email'
        }],
        getTokens: function(req, code, state, redirectURI, next) {
          assert.equal(code, TEST_AUTH_CODE_2, 'OAuth Action should request access token with expected test code.');
          assert.equal(redirectURI, TEST_REDIRECT_URI_2, 'OAuth Action should request access token with expected redirect uri.');
          return new Q([TEST_ACCESS_TOKEN_2]).nodeify(next);
        },
        getUser: function(tokens, next) {
          assert.deepEqual(tokens, [TEST_ACCESS_TOKEN_2],
            'OAuth Action should request user info with expected test access token.');
          return new Q(TEST_USER_2).nodeify(next);
        },
        getUserId: function(user) {
          assert.deepEqual(user, TEST_USER_2, 'OAuth Action should get ID from expected test user.');
          return Promise.resolve(user.id);
        },
        getUserEmail: function(user) {
          assert.deepEqual(user, TEST_USER_2, 'OAuth Action should get ID from expected test user.');
          return Promise.resolve(user.email);
        },
        refreshTokens: function(req, res, user, next) {
          assert.equal(user._id.toString(), template.users.oauthUser2._id, 'Should refresh token for the right user');
          return new Q([REFRESHED_TEST_ACCESS_TOKEN_2]).nodeify(next);
        }
      };
    });

    describe('Bootstrap', function() {
      it('Configure Project OAuth settings', function(done) {
        oauthSettings.oauth.openid.roles = [{ role: template.roles.administrator._id.toString()}]
        var tempSettings = _.assign({}, template.project.settings, oauthSettings);
        request(app)
          .put('/project/' + template.project._id)
          .send({
            settings: tempSettings
          })
          .set('x-jwt-token', template.formio.owner.token)
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
            assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
            assert.equal(response.access[0].type, 'create_all');
            assert.notEqual(response.access[0].roles, [], 'The create_all Administrator `role` should not be empty.');
            assert.equal(response.access[1].type, 'read_all');
            assert.notEqual(response.access[1].roles, [], 'The read_all Administrator `role` should not be empty.');
            assert.equal(response.access[2].type, 'update_all');
            assert.notEqual(response.access[2].roles, [], 'The update_all Administrator `role` should not be empty.');
            assert.equal(response.access[3].type, 'delete_all');
            assert.notEqual(response.access[3].roles, [], 'The delete_all Administrator `role` should not be empty.');
            assert.notEqual(response.defaultAccess, [], 'The Projects default `role` should not be empty.');
            assert.equal(response.hasOwnProperty('name'), true);
            assert.equal(response.name, template.project.name);
            assert.equal(response.description, template.project.description);
            assert.deepEqual(response.settings, tempSettings);

            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a User Resource for OAuth Action tests', function(done) {
        var oauthUserResource = {
          title: 'Oauth User',
          name: 'oauthUser',
          path: 'oauthuser',
          type: 'resource',
          access: [],
          submissionAccess: [],
          components: [
            {
              input: true,
              inputType: 'email',
              label: 'Email',
              key: 'email',
              type: 'email',
              validate: {
                required: true
              }
            },
            {
              input: true,
              inputType: 'password',
              label: 'password',
              key: 'password',
              type: 'password',
              validate: {
                required: true
              }
            }
          ]
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthUserResource)
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
            assert.equal(response.title, oauthUserResource.title);
            assert.equal(response.name, oauthUserResource.name);
            assert.equal(response.path, oauthUserResource.path);
            assert.equal(response.type, 'resource');
            assert.equal(response.access.length, 1);
            assert.equal(response.access[0].type, 'read_all');
            assert.equal(response.access[0].roles.length, 3);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.anonymous._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.authenticated._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.administrator._id.toString()), -1);
            assert.deepEqual(response.submissionAccess, []);
            assert.deepEqual(response.components, oauthUserResource.components);
            template.forms.oauthUserResource = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a Register Form for OAuth Action tests', function(done) {
        var oauthRegisterForm = {
          title: 'OAuth Register Form',
          name: 'oauthRegisterForm',
          path: 'oauthregisterform',
          type: 'form',
          access: [],
          submissionAccess: [],
          noSave: true,
          components: [
            {
              input: true,
              inputType: 'email',
              label: 'Email',
              key: 'email',
              type: 'email',
              validate: {
                required: true
              }
            },
            {
              input: true,
              inputType: 'password',
              label: 'password',
              key: 'password',
              type: 'password',
              validate: {
                required: true
              }
            },
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthSignup1',
              label: 'Sign-Up with Test1'
            },
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthSignup2',
              label: 'Sign-Up with Test2'
            }
          ]
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthRegisterForm)
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
            assert.equal(response.title, oauthRegisterForm.title);
            assert.equal(response.name, oauthRegisterForm.name);
            assert.equal(response.path, oauthRegisterForm.path);
            assert.equal(response.type, 'form');
            assert.equal(response.access.length, 1);
            assert.equal(response.access[0].type, 'read_all');
            assert.equal(response.access[0].roles.length, 3);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.anonymous._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.authenticated._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.administrator._id.toString()), -1);
            assert.deepEqual(response.submissionAccess, []);
            assert.deepEqual(response.components, oauthRegisterForm.components);
            template.forms.oauthRegisterForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a Login Form for OAuth Action tests', function(done) {
        var oauthLoginForm = {
          title: 'OAuth Login Form',
          name: 'oauthLoginForm',
          path: 'oauthloginform',
          type: 'form',
          access: [],
          submissionAccess: [],
          components: [
            {
              input: true,
              inputType: 'email',
              label: 'Email',
              key: 'email',
              type: 'email',
              validate: {
                required: true
              }
            },
            {
              input: true,
              inputType: 'password',
              label: 'password',
              key: 'password',
              type: 'password',
              validate: {
                required: true
              }
            },
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthSignin1',
              label: 'Sign-In with Test1'
            },
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthSignin2',
              label: 'Sign-In with Test2'
            }
          ]
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthLoginForm)
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
            assert.equal(response.title, oauthLoginForm.title);
            assert.equal(response.name, oauthLoginForm.name);
            assert.equal(response.path, oauthLoginForm.path);
            assert.equal(response.type, 'form');
            assert.equal(response.access.length, 1);
            assert.equal(response.access[0].type, 'read_all');
            assert.equal(response.access[0].roles.length, 3);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.anonymous._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.authenticated._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.administrator._id.toString()), -1);
            assert.deepEqual(response.submissionAccess, []);
            assert.deepEqual(response.components, oauthLoginForm.components);
            template.forms.oauthLoginForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a Link Form for OAuth Action tests', function(done) {
        var oauthLinkForm = {
          title: 'OAuth Link Form',
          name: 'oauthLinkForm',
          path: 'oauthlinkform',
          type: 'form',
          access: [],
          submissionAccess: [],
          components: [
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthLink1',
              label: 'Link with Test1'
            },
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthLink2',
              label: 'Link with Test2'
            }
          ]
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthLinkForm)
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
            assert.equal(response.title, oauthLinkForm.title);
            assert.equal(response.name, oauthLinkForm.name);
            assert.equal(response.path, oauthLinkForm.path);
            assert.equal(response.type, 'form');
            assert.equal(response.access.length, 1);
            assert.equal(response.access[0].type, 'read_all');
            assert.equal(response.access[0].roles.length, 3);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.anonymous._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.authenticated._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.administrator._id.toString()), -1);
            assert.deepEqual(response.submissionAccess, []);
            assert.deepEqual(response.components, oauthLinkForm.components);
            template.forms.oauthLinkForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      // We attach Auth actions because oauth is supposed to override
      // them and prevent them from returning errors.
      it('Create AuthUserRole for OAuth User Resource', function(done) {
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthUserResource._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send({
            title: 'Role Assignment',
            name: 'role',
            priority: 1,
            handler: ['after'],
            method: ['create'],
            settings: {
              association: 'new',
              type: 'add',
              role: template.roles.authenticated._id.toString()
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            template.users.admin.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('Set up submission create_own access for Anonymous users for Register Form', function(done) {
        request(app)
          .put(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id, template))
          .set('x-jwt-token', template.users.admin.token)
          .send({submissionAccess: [{
            type: 'create_own',
            roles: [template.roles.anonymous._id.toString()]
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.submissionAccess[0].type, 'create_own');
            assert.equal(response.submissionAccess[0].roles.length, 1);
            assert.equal(response.submissionAccess[0].roles[0], template.roles.anonymous._id.toString());

            // Save this form for later use.
            template.forms.oauthRegisterForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Set up submission create_own access for Anonymous users for Login Form', function(done) {
        request(app)
          .put(hook.alter('url', '/form/' + template.forms.oauthLoginForm._id, template))
          .set('x-jwt-token', template.users.admin.token)
          .send({submissionAccess: [{
            type: 'create_own',
            roles: [template.roles.anonymous._id.toString()]
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.submissionAccess[0].type, 'create_own');
            assert.equal(response.submissionAccess[0].roles.length, 1);
            assert.equal(response.submissionAccess[0].roles[0], template.roles.anonymous._id.toString());

            // Save this form for later use.
            template.forms.oauthLoginForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Set up submission create_own access for Authenticated users for Link Form', function(done) {
        request(app)
          .put(hook.alter('url', '/form/' + template.forms.oauthLinkForm._id, template))
          .set('x-jwt-token', template.users.admin.token)
          .send({submissionAccess: [{
            type: 'create_own',
            roles: [template.roles.authenticated._id.toString()]
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.submissionAccess[0].type, 'create_own');
            assert.equal(response.submissionAccess[0].roles.length, 1);
            assert.equal(response.submissionAccess[0].roles[0], template.roles.authenticated._id.toString());

            // Save this form for later use.
            template.forms.oauthLinkForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create AuthRegisterAction for Register Form', function(done) {
        var authRegisterAction = {
          title: "Save Submission",
          name: "save",
          handler: ["before"],
          method: ["create", "update"],
          priority: 11,
          settings: {
            resource: template.forms.oauthUserResource._id.toString(),
            fields: {
              email: "email",
              password: "password"
            }
          }
        };
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(authRegisterAction)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, authRegisterAction.title);
            assert.equal(response.name, authRegisterAction.name);
            assert.deepEqual(response.handler, authRegisterAction.handler);
            assert.deepEqual(response.method, authRegisterAction.method);
            assert.equal(response.priority, authRegisterAction.priority);
            assert.deepEqual(response.settings, authRegisterAction.settings);
            assert.equal(response.form, template.forms.oauthRegisterForm._id);
            template.actions['oauthRegisterForm:save'] = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });
      it('Create AuthLoginAction for Register Form', function(done) {
        var authRegisterLoginAction = {
          "name": "login",
          "title": "Login",
          "priority": 2,
          "method": ["create"],
          "handler": ["before"],
          "settings": {
            "resources": [template.forms.oauthUserResource._id.toString()],
            "username": "email",
            "password": "password"
          }
        };
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(authRegisterLoginAction)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, authRegisterLoginAction.title);
            assert.equal(response.name, authRegisterLoginAction.name);
            assert.deepEqual(response.handler, authRegisterLoginAction.handler);
            assert.deepEqual(response.method, authRegisterLoginAction.method);
            assert.equal(response.priority, authRegisterLoginAction.priority);
            assert.deepEqual(response.settings, authRegisterLoginAction.settings);
            assert.equal(response.form, template.forms.oauthRegisterForm._id);
            template.actions['oauthRegisterForm:login'] = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create AuthLoginAction for Login Form', function(done) {
        var authLoginAction = {
          "name": "login",
          "title": "Login",
          "priority": 2,
          "method": ["create"],
          "handler": ["before"],
          "settings": {
            "resources": [template.forms.oauthUserResource._id.toString()],
            "username": "email",
            "password": "password"
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(authLoginAction)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, authLoginAction.title);
            assert.equal(response.name, authLoginAction.name);
            assert.deepEqual(response.handler, authLoginAction.handler);
            assert.deepEqual(response.method, authLoginAction.method);
            assert.equal(response.priority, authLoginAction.priority);
            assert.deepEqual(response.settings, authLoginAction.settings);
            assert.equal(response.form, template.forms.oauthLoginForm._id);
            authLoginAction = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create OAuthAction for test1 provider for Register Form', function(done) {
        var oauthRegisterAction1 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'test1',
            association: 'new',
            resource: template.forms.oauthUserResource.name,
            role: template.roles.authenticated._id.toString(),
            button: 'oauthSignup1',
            'autofill-test1-email': 'email'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthRegisterAction1)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthRegisterAction1.title);
            assert.equal(response.name, oauthRegisterAction1.name);
            assert.deepEqual(response.handler, oauthRegisterAction1.handler);
            assert.deepEqual(response.method, oauthRegisterAction1.method);
            assert.equal(response.priority, oauthRegisterAction1.priority);
            assert.deepEqual(response.settings, oauthRegisterAction1.settings);
            assert.equal(response.form, template.forms.oauthRegisterForm._id);
            oauthRegisterAction1 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create OAuthAction for test1 provider for Login Form', function(done) {
        var oauthLoginAction1 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'test1',
            association: 'existing',
            resource: template.forms.oauthUserResource.name,
            button: 'oauthSignin1'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthLoginAction1)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthLoginAction1.title);
            assert.equal(response.name, oauthLoginAction1.name);
            assert.deepEqual(response.handler, oauthLoginAction1.handler);
            assert.deepEqual(response.method, oauthLoginAction1.method);
            assert.equal(response.priority, oauthLoginAction1.priority);
            assert.deepEqual(response.settings, oauthLoginAction1.settings);
            assert.equal(response.form, template.forms.oauthLoginForm._id);
            oauthLoginAction1 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create OAuthAction for test1 provider for Link Form', function(done) {
        var oauthLinkAction1 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'test1',
            association: 'link',
            button: 'oauthSignin1'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLinkForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthLinkAction1)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthLinkAction1.title);
            assert.equal(response.name, oauthLinkAction1.name);
            assert.deepEqual(response.handler, oauthLinkAction1.handler);
            assert.deepEqual(response.method, oauthLinkAction1.method);
            assert.equal(response.priority, oauthLinkAction1.priority);
            assert.deepEqual(response.settings, oauthLinkAction1.settings);
            assert.equal(response.form, template.forms.oauthLinkForm._id);
            oauthLinkAction1 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create OAuthAction for test2 provider for Register Form', function(done) {
        var oauthRegisterAction2 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'test2',
            association: 'new',
            resource: template.forms.oauthUserResource.name,
            role: template.roles.authenticated._id.toString(),
            button: 'oauthSignup2',
            'autofill-test2-email': 'email'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthRegisterAction2)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthRegisterAction2.title);
            assert.equal(response.name, oauthRegisterAction2.name);
            assert.deepEqual(response.handler, oauthRegisterAction2.handler);
            assert.deepEqual(response.method, oauthRegisterAction2.method);
            assert.equal(response.priority, oauthRegisterAction2.priority);
            assert.deepEqual(response.settings, oauthRegisterAction2.settings);
            assert.equal(response.form, template.forms.oauthRegisterForm._id);
            oauthRegisterAction2 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create OAuthAction for test2 provider for Login Form', function(done) {
        var oauthLoginAction2 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'test2',
            association: 'existing',
            resource: template.forms.oauthUserResource.name,
            button: 'oauthSignin2'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthLoginAction2)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthLoginAction2.title);
            assert.equal(response.name, oauthLoginAction2.name);
            assert.deepEqual(response.handler, oauthLoginAction2.handler);
            assert.deepEqual(response.method, oauthLoginAction2.method);
            assert.equal(response.priority, oauthLoginAction2.priority);
            assert.deepEqual(response.settings, oauthLoginAction2.settings);
            assert.equal(response.form, template.forms.oauthLoginForm._id);
            oauthLoginAction2 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create OAuthAction for test2 provider for Link Form', function(done) {
        var oauthLinkAction2 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'test2',
            association: 'link',
            button: 'oauthSignin2'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLinkForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthLinkAction2)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthLinkAction2.title);
            assert.equal(response.name, oauthLinkAction2.name);
            assert.deepEqual(response.handler, oauthLinkAction2.handler);
            assert.deepEqual(response.method, oauthLinkAction2.method);
            assert.equal(response.priority, oauthLinkAction2.priority);
            assert.deepEqual(response.settings, oauthLinkAction2.settings);
            assert.equal(response.form, template.forms.oauthLinkForm._id);
            oauthLinkAction2 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('After Form Handler', function() {
      it('Should not modify a Form Read without ?live=1', function(done) {
        request(app)
          .get(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id, template))
          .set('x-jwt-token', template.users.admin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(response, ignoreFields), _.omit(template.forms.oauthRegisterForm, ignoreFields));

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should modify a Form Read with ?live=1', function(done) {
        request(app)
          .get(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '?live=1', template))
          .set('x-jwt-token', template.users.admin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            response.components = util.flattenComponents(response.components);
            var flattenedComponents = util.flattenComponents(template.forms.oauthRegisterForm.components);
            _.each(response.components, function(component, i) {
              if (component.action === 'oauth') {
                if (component.key === 'oauthSignup1') {
                  assert.equal(component.oauth.provider, app.formio.formio.oauth.providers.test1.name);
                  assert.equal(component.oauth.clientId, oauthSettings.oauth.test1.clientId);
                  assert.equal(component.oauth.authURI, app.formio.formio.oauth.providers.test1.authURI);
                  assert.equal(component.oauth.scope, app.formio.formio.oauth.providers.test1.scope);
                  assert.equal(component.oauth.display, app.formio.formio.oauth.providers.test1.display);
                }
                if (component.key === 'oauthSignup2') {
                  assert.equal(component.oauth.provider, app.formio.formio.oauth.providers.test2.name);
                  assert.equal(component.oauth.clientId, oauthSettings.oauth.test2.clientId);
                  assert.equal(component.oauth.authURI, app.formio.formio.oauth.providers.test2.authURI);
                  assert.equal(component.oauth.scope, app.formio.formio.oauth.providers.test2.scope);
                  assert.equal(component.oauth.display, app.formio.formio.oauth.providers.test2.display);
                }
                assert.deepEqual(_.omit(component, 'oauth', 'path'), flattenedComponents[i],
                  'OAuth button should only have oauth prop added');
              }
              else {
                assert.deepEqual(component, flattenedComponents[i], 'Non oauth buttons should remain unchanged');
              }
            });

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('OAuth Submission Handler', function() {
      it('An anonymous user should be able to register with OAuth provider test1', function(done) {
        var submission = {
          data: {},
          oauth: {
            test1: {
              code: TEST_AUTH_CODE_1,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_1
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '/submission', template))
          .send(submission)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert.equal(response.data.email, TEST_USER_1.email, 'The OAuth Action should autofill the email field.');
            assert.equal(response.form, template.forms.oauthUserResource._id, 'The submission returned should be for the authenticated resource.');
            assert(response.hasOwnProperty('roles'), 'The response should contain the resource `roles`.');
            assert.deepEqual(response.roles, [template.roles.authenticated._id.toString()], 'The submission should have the OAuth Action configured role added to it.');
            assert.equal(response.externalIds.length, 1);
            assert(response.externalIds[0].hasOwnProperty('_id'), 'The externalId should contain an `_id`.');
            assert(response.externalIds[0].hasOwnProperty('created'), 'The externalId should contain a `created` timestamp.');
            assert.equal(response.externalIds[0].type, app.formio.formio.oauth.providers.test1.name, 'The externalId should be for test1 oauth.');
            assert.equal(response.externalIds[0].id, TEST_USER_1.id, 'The externalId should match test user 1\'s id.');
            assert(!response.hasOwnProperty('deleted'), 'The response should not contain `deleted`');
            assert(!response.hasOwnProperty('__v'), 'The response should not contain `__v`');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
            assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
            assert.notEqual(response.owner, null);
            assert.equal(response.owner, response._id);

            checkExternalTokens(response, [TEST_ACCESS_TOKEN_1])
            .then(function() {
              done();
            }).catch(done);

            // Save user for later tests
            template.users.oauthUser1 = response;
            template.users.oauthUser1.token = res.headers['x-jwt-token'];

          });
      });

      it('An anonymous user should be able to register with OAuth provider test2', function(done) {
        var submission = {
          data: {},
          oauth: {
            test2: {
              code: TEST_AUTH_CODE_2,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_2
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '/submission', template))
          .send(submission)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert.equal(response.data.email, TEST_USER_2.email, 'The OAuth Action should autofill the email field.');
            assert.equal(response.form, template.forms.oauthUserResource._id, 'The submission returned should be for the authenticated resource.');
            assert(response.hasOwnProperty('roles'), 'The response should contain the resource `roles`.');
            assert.deepEqual(response.roles, [template.roles.authenticated._id.toString()], 'The submission should have the OAuth Action configured role added to it.');
            assert.equal(response.externalIds.length, 1);
            assert(response.externalIds[0].hasOwnProperty('_id'), 'The externalId should contain an `_id`.');
            assert(response.externalIds[0].hasOwnProperty('created'), 'The externalId should contain a `created` timestamp.');
            assert.equal(response.externalIds[0].type, app.formio.formio.oauth.providers.test2.name, 'The externalId should be for test2 oauth.');
            assert.equal(response.externalIds[0].id, TEST_USER_2.id, 'The externalId should match test user 2\'s id.');
            assert(!response.hasOwnProperty('deleted'), 'The response should not contain `deleted`');
            assert(!response.hasOwnProperty('__v'), 'The response should not contain `__v`');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
            assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
            assert.notEqual(response.owner, null);
            assert.equal(response.owner, response._id);

            checkExternalTokens(response, [TEST_ACCESS_TOKEN_2])
            .then(function() {
              done();
            }).catch(done);

            // Save user for later tests
            template.users.oauthUser2 = response;
            template.users.oauthUser2.token = res.headers['x-jwt-token'];
          });
      });

      it('An anonymous user should be able to login with OAuth provider test1', function(done) {
        var submission = {
          data: {},
          oauth: {
            test1: {
              code: TEST_AUTH_CODE_1,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_1
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLoginForm._id + '/submission', template))
          .send(submission)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert.equal(response.data.email, TEST_USER_1.email, 'The OAuth Action should return a user with the right email.');
            assert.equal(response.form, template.forms.oauthUserResource._id, 'The submission returned should be for the authenticated resource.');
            assert(response.hasOwnProperty('roles'), 'The response should contain the resource `roles`.');
            assert.deepEqual(response.roles, [template.roles.authenticated._id.toString()], 'The submission should have the OAuth Action configured role.');
            assert.equal(response.externalIds.length, 1);
            assert(response.externalIds[0].hasOwnProperty('_id'), 'The externalId should contain an `_id`.');
            assert(response.externalIds[0].hasOwnProperty('created'), 'The externalId should contain a `created` timestamp.');
            assert.equal(response.externalIds[0].type, app.formio.formio.oauth.providers.test1.name, 'The externalId should be for test1 oauth.');
            assert.equal(response.externalIds[0].id, TEST_USER_1.id, 'The externalId should match test user 1\'s id.');
            assert(!response.hasOwnProperty('deleted'), 'The response should not contain `deleted`');
            assert(!response.hasOwnProperty('__v'), 'The response should not contain `__v`');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
            assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
            assert.notEqual(response.owner, null);
            assert.equal(response.owner, response._id);

            checkExternalTokens(response, [TEST_ACCESS_TOKEN_1])
            .then(function() {
              done();
            }).catch(done);
          });
      });

      it('An anonymous user should be able to login with OAuth provider test2', function(done) {
        var submission = {
          data: {},
          oauth: {
            test2: {
              code: TEST_AUTH_CODE_2,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_2
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLoginForm._id + '/submission', template))
          .send(submission)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert.equal(response.data.email, TEST_USER_2.email, 'The OAuth Action should return a user with the right email.');
            assert.equal(response.form, template.forms.oauthUserResource._id, 'The submission returned should be for the authenticated resource.');
            assert(response.hasOwnProperty('roles'), 'The response should contain the resource `roles`.');
            assert.deepEqual(response.roles, [template.roles.authenticated._id.toString()], 'The submission should have the OAuth Action configured role.');
            assert.equal(response.externalIds.length, 1);
            assert(response.externalIds[0].hasOwnProperty('_id'), 'The externalId should contain an `_id`.');
            assert(response.externalIds[0].hasOwnProperty('created'), 'The externalId should contain a `created` timestamp.');
            assert.equal(response.externalIds[0].type, app.formio.formio.oauth.providers.test2.name, 'The externalId should be for test2 oauth.');
            assert.equal(response.externalIds[0].id, TEST_USER_2.id, 'The externalId should match test user 2\'s id.');
            assert(!response.hasOwnProperty('deleted'), 'The response should not contain `deleted`');
            assert(!response.hasOwnProperty('__v'), 'The response should not contain `__v`');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
            assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
            assert.notEqual(response.owner, null);
            assert.equal(response.owner, response._id);

            checkExternalTokens(response, [TEST_ACCESS_TOKEN_2])
            .then(function() {
              done();
            }).catch(done);
          });
      });

      it('An anonymous user should be logged in when registering with a previously registered OAuth provider test1 account', function(done) {
        var submission = {
          data: {},
          oauth: {
            test1: {
              code: TEST_AUTH_CODE_1,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_1
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterForm._id + '/submission', template))
          .send(submission)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert.equal(response.data.email, TEST_USER_1.email, 'The OAuth Action should return a user with the right email.');
            assert.equal(response.form, template.forms.oauthUserResource._id, 'The submission returned should be for the authenticated resource.');
            assert(response.hasOwnProperty('roles'), 'The response should contain the resource `roles`.');
            assert.deepEqual(response.roles, [template.roles.authenticated._id.toString()], 'The submission should have the OAuth Action configured role.');
            assert.equal(response.externalIds.length, 1);
            assert(response.externalIds[0].hasOwnProperty('_id'), 'The externalId should contain an `_id`.');
            assert(response.externalIds[0].hasOwnProperty('created'), 'The externalId should contain a `created` timestamp.');
            assert.equal(response.externalIds[0].type, app.formio.formio.oauth.providers.test1.name, 'The externalId should be for test1 oauth.');
            assert.equal(response.externalIds[0].id, TEST_USER_1.id, 'The externalId should match test user 1\'s id.');
            assert(!response.hasOwnProperty('deleted'), 'The response should not contain `deleted`');
            assert(!response.hasOwnProperty('__v'), 'The response should not contain `__v`');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
            assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
            assert.notEqual(response.owner, null);
            assert.equal(response.owner, response._id);

            checkExternalTokens(response, [TEST_ACCESS_TOKEN_1])
            .then(function() {
              done();
            }).catch(done);
          });
      });

      it('An anonymous user should receive an error when logging in with an unlinked OAuth provider test2 account', function(done) {
        // Test values for 3rd unlinked test user
        var TEST_AUTH_CODE_3 = 'TESTAUTHCODE3';
        var TEST_ACCESS_TOKEN_3 = {
          type: 'test2',
          token: 'TESTACCESSTOKEN3',
          exp: new Date(Date.now() + 3600000)
        };
        var TEST_REDIRECT_URI_3 = 'http://client3.com';
        var TEST_USER_3 = {
          id: 777,
          email: 'user3@test3.com'
        };
        // Extend and modify dummy oauth provider to return 3rd unlinked test user
        app.formio.formio.oauth.providers.test2 = _.create(app.formio.formio.oauth.providers.test2, {
          getTokens: function(req, code, state, redirectURI, next) {
            assert.equal(code, TEST_AUTH_CODE_3, 'OAuth Action should request access token with expected test code.');
            assert.equal(redirectURI, TEST_REDIRECT_URI_3, 'OAuth Action should request access token with expected redirect uri.');
            return new Q([TEST_ACCESS_TOKEN_3]).nodeify(next);
          },
          getUser: function(tokens, next) {
            assert.deepEqual(tokens, [TEST_ACCESS_TOKEN_3],
              'OAuth Action should request user info with expected test access token.');
            return new Q(TEST_USER_3).nodeify(next);
          },
          getUserId: function(user) {
            assert.deepEqual(user, TEST_USER_3, 'OAuth Action should get ID from expected test user.');
            return Promise.resolve(user.id);
          },
          getUserEmail: function(user) {
            assert.deepEqual(user, TEST_USER_3, 'OAuth Action should get ID from expected test user.');
            return Promise.resolve(user.email);
          },
        });
        var submission = {
          data: {},
          oauth: {
            test2: {
              code: TEST_AUTH_CODE_3,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_3
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLoginForm._id + '/submission', template))
          .send(submission)
          .expect(404)
          .end(done);
      });

      it('A test1 user should be able to link his submission to his OAuth provider test2 account', function(done) {
        // Test values for 4rd unlinked test user
        var TEST_AUTH_CODE_4 = 'TESTAUTHCODE4';
        var TEST_ACCESS_TOKEN_4 = {
          type: 'test2',
          token: 'TESTACCESSTOKEN4',
          exp: new Date(Date.now() + 3600000)
        };
        var TEST_REDIRECT_URI_4 = 'http://client4.com';
        var TEST_USER_4 = {
          id: 808,
          email: 'user1@test2.com'
        };
        // Extend and modify dummy oauth provider to return 4th unlinked test user
        app.formio.formio.oauth.providers.test2 = _.create(app.formio.formio.oauth.providers.test2, {
          getTokens: function(req, code, state, redirectURI, next) {
            assert.equal(code, TEST_AUTH_CODE_4, 'OAuth Action should request access token with expected test code.');
            assert.equal(redirectURI, TEST_REDIRECT_URI_4, 'OAuth Action should request access token with expected redirect uri.');
            return new Q([TEST_ACCESS_TOKEN_4]).nodeify(next);
          },
          getUser: function(tokens, next) {
            assert.deepEqual(tokens, [TEST_ACCESS_TOKEN_4],
              'OAuth Action should request user info with expected test access token.');
            return new Q(TEST_USER_4).nodeify(next);
          },
          getUserId: function(user) {
            assert.deepEqual(user, TEST_USER_4, 'OAuth Action should get ID from expected test user.');
            return Promise.resolve(user.id);
          }
        });
        var submission = {
          data: {},
          oauth: {
            test2: {
              code: TEST_AUTH_CODE_4,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_4
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLinkForm._id + '/submission', template))
          .set('x-jwt-token', template.users.oauthUser1.token)
          .send(submission)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(
              _.omit(response, 'externalIds', 'modified', 'externalTokens'),
              _.omit(template.users.oauthUser1, 'token', 'externalIds', 'modified', 'externalTokens'),
              'The response should match the previously registered user');
            assert.equal(response.externalIds.length, 2);
            assert.notEqual(_.find(response.externalIds, {
              id: '' + TEST_USER_1.id
            }), undefined, 'The response should have a test1 external id');
            assert.notEqual(_.find(response.externalIds, {
              type: app.formio.formio.oauth.providers.test2.name,
              id: '' + TEST_USER_4.id
            }), undefined, 'The response should have a test2 external id');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

            checkExternalTokens(response, [TEST_ACCESS_TOKEN_4])
            .then(function() {
              done();
            }).catch(done);
          });
      });

      it('An anonymous user should get an error when trying to link an account', function(done) {
        // Test values for 5rd unlinked test user
        var TEST_AUTH_CODE_5 = 'TESTAUTHCODE5';
        var TEST_ACCESS_TOKEN_5 = {
          type: 'test2',
          token: 'TESTACCESSTOKEN5',
          exp: new Date(Date.now() + 3600000)
        };
        var TEST_REDIRECT_URI_5 = 'http://client5.com';
        var TEST_USER_5 = {
          id: 808,
          email: 'user5@test5.com'
        };
        // Extend and modify dummy oauth provider to return 5th unlinked test user
        app.formio.formio.oauth.providers.test2 = _.create(app.formio.formio.oauth.providers.test2, {
          getTokens: function(req, code, state, redirectURI, next) {
            assert.equal(code, TEST_AUTH_CODE_5, 'OAuth Action should request access token with expected test code.');
            assert.equal(redirectURI, TEST_REDIRECT_URI_5, 'OAuth Action should request access token with expected redirect uri.');
            return new Q([TEST_ACCESS_TOKEN_5]).nodeify(next);
          },
          getUser: function(tokens, next) {
            assert.deepEqual(tokens, [TEST_ACCESS_TOKEN_5],
              'OAuth Action should request user info with expected test access token.');
            return new Q(TEST_USER_5).nodeify(next);
          },
          getUserId: function(user) {
            assert.deepEqual(user, TEST_USER_5, 'OAuth Action should get ID from expected test user.');
            return Promise.resolve(user.id);
          }
        });
        var submission = {
          data: {},
          oauth: {
            test2: {
              code: TEST_AUTH_CODE_5,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_5
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLinkForm._id + '/submission', template))
          .send(submission)
          .expect(401)
          .end(done);
      });

      it('A user should get an error when trying to link an already linked account', function(done) {
        var submission = {
          data: {},
          oauth: {
            test1: {
              code: TEST_AUTH_CODE_1,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI_1
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthLinkForm._id + '/submission', template))
          .set('x-jwt-token', template.users.oauthUser2.token)
          .send(submission)
          .expect(400)
          .end(done);
      });
    });

    describe('getUserToken', function() {
      it('should return an unexpired access token', function() {
        return app.formio.formio.oauth.getUserToken({}, {}, 'test1', template.users.oauthUser1._id)
        .then(function(token) {
          assert.deepEqual(token, TEST_ACCESS_TOKEN_1.token, 'Returned token should match correct token.');
        });
      });

      it('should refresh an expired token and return the new token', function() {
        return app.formio.formio.oauth.getUserToken({}, {}, 'test2', template.users.oauthUser2._id)
        .then(function(token) {
          assert.deepEqual(token, REFRESHED_TEST_ACCESS_TOKEN_2.token, 'Returned token should match correct token.');
          checkExternalTokens(template.users.oauthUser2, [REFRESHED_TEST_ACCESS_TOKEN_2]);
        });
      });
    });

    describe('Tests for multiple oAuth Actions per form', function() {
      const OPENID_PAYLOAD_1 = {
        data:{},
        oauth:{
          openid:{
            code:'0.AYEAJK7ji5BsNU-tpz7tT39yDI73sB5VvIBJrXNuANa75KyBAAA.AQABAAIAAAD--DLA3VO7QrddgJg7WevrhFvv0LV6AkztdmOJAcJ8lLkuG8hpJvt-RcgcKETEs3J8ohduux7qcmRHJZzDTjpz8w_R5gaKoCykopsXHNsDr2TPmngJrAGgPDA9WGix8uHc1WzVhL2G54ILL-NQDvVCH5G91X02ybO6uDJnhNI812CdofP5z3_UmV4hY3X1hm-SLh_VWpv6QIleBAkw82xsIWd8UHWPWrIBT-G4OW05Rwl1ddjUMX0WJB3y6dZH1PfJzXxv0XJnge8rxL3X-gGMQnkuvnhhzKYix57UIDQJlk-hJmitubeJQ4DTsNE7ZWfIR6XhDnzxuMc4CyVTthrTzxE2wO2H8KIpW_coC2WUqRuc8OEscUBZCqT28AkboTxaULjsiV1AslgFr0aZlvC5ZXLTFCde4aVcs3cAqCH-uQr6Z5rBtLlc0kBWMCM_j0RTt7Rb0cGl33c3PBu4uVLC5ZlOnHfLu0lYaXLZWEZtLAKbm876iwlGUOS846_-_FsNvdslSG2nudIKx7h5x_IU7Wt-PQpGP4Dj5oZbsh-5YeEoNRIU-Tz1MtxGKj-aapoIELnk5icjiYVj6h4h1SNnzpoZ7WWwpiJov8NGffkEdFfzKreUeshYNHVUxFddqWPPa6xmM4PBF5UvS3BaTe7-fOmG8BUtFEQcBPQyrNHnunEFrYJou9G8XtT6R6MJKDq1ch2DINUEnilv19AwWtSCy517ZCQneFG1RkG6mvA9HwMGoTNPFUwELAm1hszJkP_yCXQhwt3-V9-xDjPbPLVk8ZwfpCEP1A5IZsQpQvdVQghNBIKxr78mnzpjneHA-H77eXHNvbkYJPheHNP0s81kqi798grELg3lIthJd1Pbr9AjdVxGkKPK2XF1mrTsnNJgv-pNfHxHDSAkpYe71Yu1OKJ6_wUQwd7av6HyYHOyCRSPF8oB0Q9Dn85Iy2GAj6o9fagKZble6qTaDvY2VmLutW78jVpuf6w_5Nq5o6kH2yAA',
            state: 'c9d7bb8c797ddc650eaccb07303e8c5714de6a7e4c015e82d2f2b05b965903f3e53c903efd4ca3eaf2ad099058478ea7340a2e860445002df91fcf3ea40f1896',
            session_state: 'ff3a2704-e053-4ca3-852e-a94f87f50983',
            redirectURI: 'http://localhost:3000'
          }
        }
      };

      const OPENID_PAYLOAD_2 = {
        data:{},
        oauth:{
          openid:{
            code:'0.AYEAJK7ji5BsNU-tpz7tT39yDI73sB5VvIBJrXNuANa75KyBAAA.AQABAAIAAAD--DLA3VO7QrddgJg7WevrhFvv0LV6AkztdmOJAcJ8lLkuG8hpJvt-RcgcKETEs3J8ohduux7qcmRHJZzDTjpz8w_R5gaKoCykopsXHNsDr2TPmngJrAGgPDA9WGix8uHc1WzVhL2G54ILL-NQDvVCH5G91X02ybO6uDJnhNI812CdofP5z3_UmV4hY3X1hm-SLh_VWpv6QIleBAkw82xsIWd8UHWPWrIBT-G4OW05Rwl1ddjUMX0WJB3y6dZH1PfJzXxv0XJnge8rxL3X-gGMQnkuvnhhzKYix57UIDQJlk-hJmitubeJQ4DTsNE7ZWfIR6XhDnzxuMc4CyVTthrTzxE2wO2H8KIpW_coC2WUqRuc8OEscUBZCqT28AkboTxaULjsiV1AslgFr0aZlvC5ZXLTFCde4aVcs3cAqCH-uQr6Z5rBtLlc0kBWMCM_j0RTt7Rb0cGl33c3PBu4uVLC5ZlOnHfLu0lYaXLZWEZtLAKbm876iwlGUOS846_-_FsNvdslSG2nudIKx7h5x_IU7Wt-PQpGP4Dj5oZbsh-5YeEoNRIU-Tz1MtxGKj-aapoIELnk5icjiYVj6h4h1SNnzpoZ7WWwpiJov8NGffkEdFfzKreUeshYNHVUxFddqWPPa6xmM4PBF5UvS3BaTe7-fOmG8BUtFEQcBPQyrNHnunEFrYJou9G8XtT6R6MJKDq1ch2DINUEnilv19AwWtSCy517ZCQneFG1RkG6mvA9HwMGoTNPFUwELAm1hszJkP_yCXQhwt3-V9-xDjPbPLVk8ZwfpCEP1A5IZsQpQvdVQghNBIKxr78mnzpjneHA-H77eXHNvbkYJPheHNP0s81kqi798grELg3lIthJd1Pbr9AjdVxGkKPK2XF1mrTsnNJgv-pNfHxHDSAkpYe71Yu1OKJ6_wUQwd7av6HyYHOyCRSPF8oB0Q9Dn85Iy2GAj6o9fagKZble6qTaDvY2VmLutW78jVpuf6w_5Nq5o6kH2yAA',
            state: 'c9d7bb8c797ddc650eaccb07303e8c5714de6a7e4c015e82d2f2b05b965903f3e53c903efd4ca3eaf2ad099058478ea7340a2e860445002df91fcf3ea40f1896',
            session_state: 'ff3a2704-e053-4ca3-852e-a94f87f50983',
            redirectURI: 'http://localhost:3000',
            triggeredBy: 'oauthSignup',
          }
        }
      };

      it('Create a Form with Register and Login OAuth Action tests', function(done) {
        var oauthRegisterAndLoginForm = {
          title: 'OAuth Register and Login Form',
          name: 'oauthRegisterAndLoginForm',
          path: 'oauthregisterandloginform',
          type: 'form',
          access: [],
          submissionAccess: [],
          noSave: true,
          components: [
            {
              input: true,
              inputType: 'email',
              label: 'Email',
              key: 'email',
              type: 'email',
              validate: {
                required: true
              }
            },
            {
              input: true,
              inputType: 'password',
              label: 'password',
              key: 'password',
              type: 'password',
              validate: {
                required: true
              }
            },
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthSignup',
              label: 'Sign-Up with OpenId'
            },
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'oauthLogin',
              label: 'Login with OpenId'
            }
          ]
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthRegisterAndLoginForm)
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
            assert.equal(response.title, oauthRegisterAndLoginForm.title);
            assert.equal(response.name, oauthRegisterAndLoginForm.name);
            assert.equal(response.path, oauthRegisterAndLoginForm.path);
            assert.equal(response.type, 'form');
            assert.equal(response.access.length, 1);
            assert.equal(response.access[0].type, 'read_all');
            assert.equal(response.access[0].roles.length, 3);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.anonymous._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.authenticated._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.administrator._id.toString()), -1);
            assert.deepEqual(response.submissionAccess, []);
            assert.deepEqual(response.components, oauthRegisterAndLoginForm .components);
            template.forms.oauthRegisterAndLoginForm  = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });


      it('Set up submission create_own access for Anonymous users for Register and Login Form', function(done) {
        request(app)
          .put(hook.alter('url', '/form/' + template.forms.oauthRegisterAndLoginForm ._id, template))
          .set('x-jwt-token', template.users.admin.token)
          .send({submissionAccess: [{
            type: 'create_own',
            roles: [template.roles.anonymous._id.toString()]
          }]})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.submissionAccess[0].type, 'create_own');
            assert.equal(response.submissionAccess[0].roles.length, 1);
            assert.equal(response.submissionAccess[0].roles[0], template.roles.anonymous._id.toString());

            // Save this form for later use.
            template.forms.oauthRegisterAndLoginForm  = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create AuthRegisterAction for Register and Login Form', function(done) {
        var authRegisterAction = {
          title: "Save Submission",
          name: "save",
          handler: ["before"],
          method: ["create", "update"],
          priority: 11,
          settings: {
            resource: template.forms.oauthUserResource._id.toString(),
            fields: {
              email: "email",
              password: "password"
            }
          }
        };
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterAndLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(authRegisterAction)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, authRegisterAction.title);
            assert.equal(response.name, authRegisterAction.name);
            assert.deepEqual(response.handler, authRegisterAction.handler);
            assert.deepEqual(response.method, authRegisterAction.method);
            assert.equal(response.priority, authRegisterAction.priority);
            assert.deepEqual(response.settings, authRegisterAction.settings);
            assert.equal(response.form, template.forms.oauthRegisterAndLoginForm._id);
            template.actions['oauthRegisterAndLoginForm:save'] = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });
      it('Create AuthLoginAction for Register and Login Form', function(done) {
        var authRegisterLoginAction = {
          "name": "login",
          "title": "Login",
          "priority": 2,
          "method": ["create"],
          "handler": ["before"],
          "settings": {
            "resources": [template.forms.oauthUserResource._id.toString()],
            "username": "email",
            "password": "password"
          }
        };
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterAndLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(authRegisterLoginAction)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, authRegisterLoginAction.title);
            assert.equal(response.name, authRegisterLoginAction.name);
            assert.deepEqual(response.handler, authRegisterLoginAction.handler);
            assert.deepEqual(response.method, authRegisterLoginAction.method);
            assert.equal(response.priority, authRegisterLoginAction.priority);
            assert.deepEqual(response.settings, authRegisterLoginAction.settings);
            assert.equal(response.form, template.forms.oauthRegisterAndLoginForm._id);
            template.actions['oauthRegisterAndLoginForm:login'] = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });


      it('Create first OAuthAction for openId provider for Register and Login Form', function(done) {
        var oauthRegisterAction1 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'openid',
            association: 'new',
            button: 'oauthSignup',
            resource: template.forms.oauthUserResource.name,
            role: template.roles.authenticated._id.toString(),
            'autofill-test1-email': 'email'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterAndLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthRegisterAction1)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthRegisterAction1.title);
            assert.equal(response.name, oauthRegisterAction1.name);
            assert.deepEqual(response.handler, oauthRegisterAction1.handler);
            assert.deepEqual(response.method, oauthRegisterAction1.method);
            assert.equal(response.priority, oauthRegisterAction1.priority);
            assert.deepEqual(response.settings, oauthRegisterAction1.settings);
            assert.equal(response.form, template.forms.oauthRegisterAndLoginForm._id);
            oauthRegisterAction1 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create second OAuthAction for openId provider for Register and Login Form', function(done) {
        var oauthLoginAction1 = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'openid',
            association: 'existing',
            resource: template.forms.oauthUserResource.name,
            button: 'oauthLogin'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterAndLoginForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(oauthLoginAction1)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, oauthLoginAction1.title);
            assert.equal(response.name, oauthLoginAction1.name);
            assert.deepEqual(response.handler, oauthLoginAction1.handler);
            assert.deepEqual(response.method, oauthLoginAction1.method);
            assert.equal(response.priority, oauthLoginAction1.priority);
            assert.deepEqual(response.settings, oauthLoginAction1.settings);
            assert.equal(response.form, template.forms.oauthRegisterAndLoginForm._id);
            oauthLoginAction1 = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should run two Actions and get the ERR_HTTP_HEADERS_SENT', function(done) {

        const listener = (err) => {
          assert.equal(err.code, 'ERR_HTTP_HEADERS_SENT');
          eventEmitter.removeListener('testException', listener);
          done();
        };
        eventEmitter.once('testException', listener);
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterAndLoginForm._id + '/submission', template))
          .send(OPENID_PAYLOAD_1)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
          });
      });

      it('Should run only one Action and shouldn\'t get the ERR_HTTP_HEADERS_SENT', function(done) {
        let isDoneUsed = false;

        const listener = (err) => {
          if (err && err.code === 'ERR_HTTP_HEADERS_SENT') {
            isDoneUsed = true;
            eventEmitter.removeListener('testException', listener);
            done(err);
          }
        };
        eventEmitter.once('testException', listener);
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.oauthRegisterAndLoginForm._id + '/submission', template))
          .send(OPENID_PAYLOAD_2)
          .then(() => {
            if (!isDoneUsed) {
              eventEmitter.removeListener('testException', listener);
              done()
            }
          })
          .catch(done);
      });
    });

    require('./oauth/github')(app, template, hook);
    require('./oauth/tokenSwap')(app, template, hook);
    require('./oauth/m2mOAuthToken')(app, template, hook);
  });
};
