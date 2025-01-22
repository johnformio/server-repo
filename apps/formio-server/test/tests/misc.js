/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var async = require('async');
var chance = new (require('chance'))();
var util = require('../../src/util/util');
var _ = require('lodash');
const config = require('../../config');

module.exports = function(app, template, hook) {
  let Helper = require('formio/test/helper')(app);
  describe('Project Form Modules', () => {
    var helper = null;
    it('Should create a new project with a module associated with it.', (done) => {
      helper = new Helper(template.formio.owner);
      helper
        .project({
          formModule: '{' +
            'options: {' +
              'form: {' +
                'evalContext: {' +
                  'validateBob: function(input) {' +
                    'return input.match(/^Bob$/);' +
                  '}' +
                '}' +
              '}' +
            '}' +
          '}'
        })
        .form('test', [
          {
            label: "Text Field",
            tableView: true,
            validate: {
              custom: "valid = validateBob(input) ? true : 'This is not Bob';"
            },
            key: "textField",
            type: "textfield",
            input: true
          }
        ]
      ).execute(done);
    });

    it('Should not allow a non-Bob', (done) => {
      helper.submission('test', {textField: 'Joe'}).expect(400).execute(() => {
        assert.equal(helper.lastResponse.statusCode, 400);
        assert.equal(helper.lastResponse.body.name, 'ValidationError');
        assert.equal(helper.lastResponse.body.details.length, 1);
        assert.equal(helper.lastResponse.body.details[0].message, 'This is not Bob');
        assert.deepEqual(helper.lastResponse.body.details[0].path, ['textField']);
        done();
      });
    });

    it('Should allow a Bob', (done) => {
      helper.submission('test', {textField: 'Bob'}).execute((err, response) => {
        if (err) {
          return done(err);
        }

        const submission = response.getLastSubmission();
        assert.deepEqual({textField: 'Bob'}, submission.data);
        done();
      });
    });
  });

  describe('Malformed JSON', function() {
    it('should return a 400 error', function(done) {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .set('Content-Type', 'application/json')
        .send('{"title":"abc","name":"123","description":"respect","settings":{"cors":"*"}}}}}')
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text.indexOf('Unexpected non-whitespace character'), 0);

          done();
        });
    });
  });

  describe('Projects', function() {
    if (config.formio.hosted) {
      // I'm commenting these out for now, because these look like these were designed for the 6x hosted environment, even in our
      // "hosted" 8x tests these will require investigation/clarification on expected behavior
      xit('Cant access a Project without a Project ID', function(done) {
        request(app)
          .get('/project/')
          .set('x-jwt-token', template.formio.owner.token)
          .expect(404)
          .end(function(err, res) {
            if(err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      xit('Cant access a Project without a valid Project ID', function(done) {
        request(app)
          .get(`/project/${encodeURI('💩')}`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .end(function(err, res) {
            if(err) {
              return done(err);
            }
            done();
          });
      });

      xit('The Project settings will be exposed for the Project Owner', function(done) {
        var verifySettings = function(cb) {
          var newSettings = {foo: 'bar', cors: '*'};

          request(app)
            .put('/project/' + template.project._id)
            .set('x-jwt-token', template.formio.owner.token)
            .send({settings: newSettings})
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              assert.equal(response.hasOwnProperty('settings'), true);
              assert.deepEqual(_.omit(response.settings, ['licenseKey']), newSettings);
              template.project = response;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              cb();
            });
        };

        // Update/create project settings before checking.
        verifySettings(function(err) {
          if (err) {
            return done(err);
          }

          request(app)
            .get('/project/' + template.project._id)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(200)
            .end(function(err, res) {
              if(err) {
                return done(err);
              }

              var response = res.body || {};
              assert.equal(response.hasOwnProperty('settings'), true);

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      xit('The Project settings should not be exposed for members with access that are not the Owner', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.users.admin.token)
          .expect(200)
          .end(function(err, res) {
            if(err) {
              return done(err);
            }

            var response = res.body || {};
            assert.equal(response.hasOwnProperty('settings'), false);

            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });
    }
  });

  describe('Utilities', function() {
    it('Should generate old style tokens', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user)]]">Click here to log in</a>';
      var ssoTokens = util.ssoTokens(mail);
      assert.equal(ssoTokens[0].expireTime, 120);
      assert.equal(ssoTokens[0].field, 'data.email');
      assert.deepEqual(ssoTokens[0].resources, ['user']);
    });

    it('Should generate token with multiple resources.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user, admin)]]">Click here to log in</a>';
      var ssoTokens = util.ssoTokens(mail);
      assert.equal(ssoTokens[0].expireTime, 120);
      assert.equal(ssoTokens[0].field, 'data.email');
      assert.deepEqual(ssoTokens[0].resources, ['user', 'admin']);
    });

    it('Should generate token with expire time.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user), 300]]">Click here to log in</a>';
      var ssoTokens = util.ssoTokens(mail);
      assert.equal(ssoTokens[0].expireTime, 300);
      assert.equal(ssoTokens[0].field, 'data.email');
      assert.deepEqual(ssoTokens[0].resources, ['user']);
    });

    it('Should generate token with expire time and multiple resources.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user, admin), 300]]">Click here to log in</a>';
      var ssoTokens = util.ssoTokens(mail);
      assert.equal(ssoTokens[0].expireTime, 300);
      assert.equal(ssoTokens[0].field, 'data.email');
      assert.deepEqual(ssoTokens[0].resources, ['user', 'admin']);
    });

    it('Should generate token with spaces between.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token( data.email = user, admin), 300]]">Click here to log in</a>';
      var ssoTokens = util.ssoTokens(mail);
      assert.equal(ssoTokens[0].expireTime, 300);
      assert.equal(ssoTokens[0].field, 'data.email');
      assert.deepEqual(ssoTokens[0].resources, ['user', 'admin']);
    });
  });

  describe('Forms', function() {
    var tempForm = {};

    it('A Project Owner should not be able to Create a Form without a Project ID', function(done) {
      request(app)
        .post('/project//form') // Missing project id
        .set('x-jwt-token', template.formio.owner.token)
        .send(tempForm)
        .expect(401)
        .end(function(err, res) {
          if(err) {
            return done(err);
          }

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Project Owner should not be able to Create a Form without a valid Project ID', function(done) {
      request(app)
        .post(`/project/${encodeURI('💩')}/form`) // Invalid project id
        .set('x-jwt-token', template.formio.owner.token)
        .send(tempForm)
        .expect(400)
        .end(function(err, res) {
          if(err) {
            return done(err);
          }
          done();
        });
    });

    it('An Anonymous user should not be able to Read the Index of Forms for a User-Created Project', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form')
        .expect(401)
        .end(done);
    });

    it('An Anonymous user should not be able to Read the Index of Forms for a User-Created Project with the Form filter', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form?type=form')
        .expect(401)
        .end(done);
    });

    it('A user should NOT be able to Read all forms and resources', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form')
        .set('x-jwt-token', template.users.user1.token)
        .expect(401)
        .end(done);
    });

    it('A user should not be able to Read the Index of Resource for a User-Created Project', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form?type=resource')
        .set('x-jwt-token', template.users.user1.token)
        .expect(401)
        .end(done);
    });

    it('An Anonymous user should not be able to Read the Index of Resource for a User-Created Project', function(done) {
      request(app)
        .get('/project/' + template.project._id + 'form?type=resource')
        .expect(400)
        .end(done);
    });
  });
};
