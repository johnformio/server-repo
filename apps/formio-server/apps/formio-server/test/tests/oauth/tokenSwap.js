/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');

module.exports = function(app, template, hook) {
  if (!app.formio) {
    return;
  }

  describe('Token swap', function(){
    let oauthSettings;
    let token;

    describe('Bootstrap', function() {

      it('Check openId settings', function(done) {
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

           assert(oauthSettings.openid);
           assert(oauthSettings.openid.authURL);
           assert(oauthSettings.openid.clientId);
           assert(oauthSettings.openid.clientSecret);
           assert(oauthSettings.openid.userInfoURI);
           assert(oauthSettings.openid.roles);

           // Store the JWT for future API calls.
           template.formio.owner.token = res.headers['x-jwt-token'];

           done();
          });
      });
    });

    describe ('Token swap', function() {
      it('Check exchanging of existing authorization token from the OAuth provider to form.io token', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/current')
          .set('authorization', 'TESTACCESSTOKEN')
          .expect('Access-Control-Expose-Headers', 'x-jwt-token')
          .expect(200)
          .end(function(err, res) {
              if (err) {
                return done(err);
              }
              const response = res.body;
              assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');
              assert(response.hasOwnProperty('data'), 'The response should contain an `data`.');
              assert(response.hasOwnProperty('roles'), 'The response should contain an `roles`.');
              token = res.headers['x-jwt-token'];

              done();
            });

      })

      it('Check the received x-jwt-token', function(done){
        request(app)
        .get('/project/' + template.project._id)
        .set('x-jwt-token', token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          done();
        })
      })
    })
  })
};
