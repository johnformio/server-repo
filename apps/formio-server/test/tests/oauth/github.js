/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var util = require('formio/src/util/util');

module.exports = function(app, template, hook) {
  // Cannot run these tests without access to formio instance
  if (!app.formio) {
    return;
  }

  describe('GitHub', function() {
    var oauthSettings;

    describe('Bootstrap', function() {
      // Only need a Register form because we can test both registration and
      // login with it. Everything else is covered by the general oauth tests.

      // Also reusing the oauthUserResource from the general oauth tests

      it('Create a Register Form for OAuth Action tests', function(done) {
        var githubOauthRegisterForm = {
          title: 'GitHub OAuth Register Form',
          name: 'githubOauthRegisterForm',
          path: 'githuboauthregisterform',
          type: 'form',
          access: [],
          submissionAccess: [],
          noSave: true,
          components: [
            {
              input: true,
              type: 'button',
              theme: 'primary',
              disableOnInvalid: 'false',
              action: 'oauth',
              key: 'githubSignup',
              label: 'Sign-Up with Github'
            }
          ]
        };

        request(app)
          .post(hook.alter('url', '/form', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(githubOauthRegisterForm)
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
            assert.equal(response.title, githubOauthRegisterForm.title);
            assert.equal(response.name, githubOauthRegisterForm.name);
            assert.equal(response.path, githubOauthRegisterForm.path);
            assert.equal(response.type, 'form');
            assert.equal(response.access.length, 1);
            assert.equal(response.access[0].type, 'read_all');
            assert.equal(response.access[0].roles.length, 3);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.anonymous._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.authenticated._id.toString()), -1);
            assert.notEqual(response.access[0].roles.indexOf(template.roles.administrator._id.toString()), -1);
            assert.deepEqual(response.submissionAccess, []);
            assert.deepEqual(response.components, githubOauthRegisterForm.components);
            template.forms.githubOauthRegisterForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create Save Submission Action for Register Form', function(done) {
        request(app)
          .post(hook.alter('url', '/form/' + template.forms.githubOauthRegisterForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send({
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
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Set up submission create_own access for Anonymous users for Register Form', function(done) {
        request(app)
          .put(hook.alter('url', '/form/' + template.forms.githubOauthRegisterForm._id, template))
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
            template.forms.githubOauthRegisterForm = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create OAuthAction for GitHub provider for Register Form', function(done) {
        var githubOauthRegisterAction = {
          title: 'OAuth',
          name: 'oauth',
          handler: ['after', 'before'],
          method: ['form', 'create'],
          priority: 20,
          settings: {
            provider: 'github',
            association: 'new',
            resource: template.forms.oauthUserResource.name,
            role: template.roles.authenticated._id.toString(),
            button: 'githubSignup',
            'autofill-github-email': 'email'
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.githubOauthRegisterForm._id + '/action', template))
          .set('x-jwt-token', template.users.admin.token)
          .send(githubOauthRegisterAction)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert.equal(response.title, githubOauthRegisterAction.title);
            assert.equal(response.name, githubOauthRegisterAction.name);
            assert.deepEqual(response.handler, githubOauthRegisterAction.handler);
            assert.deepEqual(response.method, githubOauthRegisterAction.method);
            assert.equal(response.priority, githubOauthRegisterAction.priority);
            assert.deepEqual(response.settings, githubOauthRegisterAction.settings);
            assert.equal(response.form, template.forms.githubOauthRegisterForm._id);
            githubOauthRegisterAction = response;

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Check OAuth settings', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            oauthSettings = res.body.settings.oauth;
            assert(oauthSettings.github);
            assert(oauthSettings.github.clientId);
            assert(oauthSettings.github.clientSecret);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('After Form Handler', function() {
      it('Should modify a Form Read with ?live=1', function(done) {
        request(app)
          .get(hook.alter('url', '/form/' + template.forms.githubOauthRegisterForm._id + '?live=1', template))
          .set('x-jwt-token', template.users.admin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            response.components = util.flattenComponents(response.components);
            var flattenedComponents = util.flattenComponents(template.forms.githubOauthRegisterForm.components);
            _.each(response.components, function(component, i) {
              if (component.action === 'oauth') {
                assert.equal(component.oauth.provider, app.formio.formio.oauth.providers.github.name);
                assert.equal(component.oauth.clientId, oauthSettings.github.clientId);
                assert.equal(component.oauth.authURI, app.formio.formio.oauth.providers.github.authURI);
                assert.equal(component.oauth.scope, app.formio.formio.oauth.providers.github.scope);
                assert.equal(component.oauth.display, app.formio.formio.oauth.providers.github.display);
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

    describe('Github OAuth Submission Handler', function() {
      var TEST_AUTH_CODE = 'TESTAUTHCODE';
      var TEST_ACCESS_TOKEN = 'TESTACCESSTOKEN';
      var TEST_REDIRECT_URI = 'http://testuri.com';
      var TEST_USER = {
        login: 'rahatarmanahmed',
        id: 123456,
        name: 'Rahat Ahmed',
        email: null // Test with private emails requiring another request
      };

      var TEST_EMAIL_RESPONSE = [
        {
          primary: true,
          verified: true,
          email: 'rahatarmanahmed@gmail.com'
        }
      ];

      it('An anonymous user should be able to register with OAuth provider GitHub', function(done) {
        var submission = {
          data: {},
          oauth: {
            github: {
              code: TEST_AUTH_CODE,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.githubOauthRegisterForm._id + '/submission', template))
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
            assert.equal(response.data.email, TEST_EMAIL_RESPONSE[0].email, 'The OAuth Action should autofill the email field.');
            assert.equal(response.form, template.forms.oauthUserResource._id, 'The submission returned should be for the authenticated resource.');
            assert(response.hasOwnProperty('roles'), 'The response should contain the resource `roles`.');
            assert.deepEqual(response.roles, [template.roles.authenticated._id.toString()], 'The submission should have the OAuth Action configured role added to it.');
            assert.equal(response.externalIds.length, 1);
            assert(response.externalIds[0].hasOwnProperty('_id'), 'The externalId should contain an `_id`.');
            assert(response.externalIds[0].hasOwnProperty('created'), 'The externalId should contain a `created` timestamp.');
            assert.equal(response.externalIds[0].type, app.formio.formio.oauth.providers.github.name, 'The externalId should be for github oauth.');
            assert.equal(response.externalIds[0].id, TEST_USER.id, 'The externalId should match test user 1\'s id.');
            assert(!response.hasOwnProperty('deleted'), 'The response should not contain `deleted`');
            assert(!response.hasOwnProperty('__v'), 'The response should not contain `__v`');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
            assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
            assert.notEqual(response.owner, null);
            assert.equal(response.owner, response._id);

            // Save user for later tests
            template.users.githubOauthUser = response;
            template.users.githubOauthUser.token = res.headers['x-jwt-token'];
            done();
        });
      });

      it('An anonymous user should be logged in when registering with a previously registered OAuth provider GitHub account', function(done) {
        var submission = {
          data: {},
          oauth: {
            github: {
              code: TEST_AUTH_CODE,
              state: 'teststate', // Scope only matters for client side validation
              redirectURI: TEST_REDIRECT_URI
            }
          }
        };

        request(app)
          .post(hook.alter('url', '/form/' + template.forms.githubOauthRegisterForm._id + '/submission', template))
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
            assert.equal(response.data.email, TEST_EMAIL_RESPONSE[0].email, 'The OAuth Action should return a user with the right email.');
            assert.equal(response.form, template.forms.oauthUserResource._id, 'The submission returned should be for the authenticated resource.');
            assert(response.hasOwnProperty('roles'), 'The response should contain the resource `roles`.');
            assert.deepEqual(response.roles, [template.roles.authenticated._id.toString()], 'The submission should have the OAuth Action configured role.');
            assert.equal(response.externalIds.length, 1);
            assert(response.externalIds[0].hasOwnProperty('_id'), 'The externalId should contain an `_id`.');
            assert(response.externalIds[0].hasOwnProperty('created'), 'The externalId should contain a `created` timestamp.');
            assert.equal(response.externalIds[0].type, app.formio.formio.oauth.providers.github.name, 'The externalId should be for github oauth.');
            assert.equal(response.externalIds[0].id, TEST_USER.id, 'The externalId should match test user 1\'s id.');
            assert(!response.hasOwnProperty('deleted'), 'The response should not contain `deleted`');
            assert(!response.hasOwnProperty('__v'), 'The response should not contain `__v`');
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
            assert(response.hasOwnProperty('owner'), 'The response should contain the resource `owner`.');
            assert.notEqual(response.owner, null);
            assert.equal(response.owner, response._id);

            done();
          });
      });
    });
  });
};
