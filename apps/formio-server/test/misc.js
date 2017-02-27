/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var async = require('async');
var chance = new (require('chance'))();
var util = require('../src/util/util');
module.exports = function(app, template, hook) {
  describe('Malformed JSON', function() {
    it('should return a 400 error', function(done) {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .set('Content-Type', 'application/json')
        .send('{"title":"abc","name":"123","description":"respect","settings":{"cors":"*"}💩')
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text.indexOf('Unexpected token �'), 0);

          done();
        });
    });
  });

  describe('Projects', function() {
    it('Cant access a Project without a Project ID', function(done) {
      request(app)
        .get('/project//')
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

    it('Cant access a Project without a valid Project ID', function(done) {
      request(app)
        .get('/project/💩')
        .set('x-jwt-token', template.formio.owner.token)
        .expect(400)
        .end(function(err, res) {
          if(err) {
            return done(err);
          }

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('The Project settings will be exposed for the Project Owner', function(done) {
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
            assert.deepEqual(response.settings, newSettings);
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

    it('The Project settings should not be exposed for members with access that are not the Owner', function(done) {
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
  });

  describe('Utilities', function() {
    it('Should generate old style tokens', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user)]]">Click here to log in</a>';
      var ssoToken = util.ssoToken(mail);
      assert.equal(ssoToken.expireTime, 120);
      assert.equal(ssoToken.field, 'data.email');
      assert.deepEqual(ssoToken.resources, ['user']);
    });

    it('Should generate token with multiple resources.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user, admin)]]">Click here to log in</a>';
      var ssoToken = util.ssoToken(mail);
      assert.equal(ssoToken.expireTime, 120);
      assert.equal(ssoToken.field, 'data.email');
      assert.deepEqual(ssoToken.resources, ['user', 'admin']);
    });

    it('Should generate token with expire time.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user), 300]]">Click here to log in</a>';
      var ssoToken = util.ssoToken(mail);
      assert.equal(ssoToken.expireTime, 300);
      assert.equal(ssoToken.field, 'data.email');
      assert.deepEqual(ssoToken.resources, ['user']);
    });

    it('Should generate token with expire time and multiple resources.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token(data.email=user, admin), 300]]">Click here to log in</a>';
      var ssoToken = util.ssoToken(mail);
      assert.equal(ssoToken.expireTime, 300);
      assert.equal(ssoToken.field, 'data.email');
      assert.deepEqual(ssoToken.resources, ['user', 'admin']);
    });

    it('Should generate token with spaces between.', function() {
      var mail = '<a class="btn btn-primary" href="https://google.com/?token=[[token( data.email = user, admin), 300]]">Click here to log in</a>';
      var ssoToken = util.ssoToken(mail);
      assert.equal(ssoToken.expireTime, 300);
      assert.equal(ssoToken.field, 'data.email');
      assert.deepEqual(ssoToken.resources, ['user', 'admin']);
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
        .post('/project/💩/form') // Invalid project id
        .set('x-jwt-token', template.formio.owner.token)
        .send(tempForm)
        .expect(400)
        .end(function(err, res) {
          if(err) {
            return done(err);
          }

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });
  });
};
