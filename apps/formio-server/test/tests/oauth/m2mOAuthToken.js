/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
const nock = require('nock');

let m2mCounter = 0;

nock('https://m2mtoken.com').post('/token')
  .reply(200, (...args) => {
    const date = new Date();
    date.setHours(date.getHours() + 1);

    const token = `TEST_M2M_TOKEN${m2mCounter ? m2mCounter : ''}`;
    m2mCounter++;
    return {
      access_token: token,
      expires_in: 71974,
      expires_at: date.toISOString(),
      scope: 'read trust',
      token_type: 'bearer'
    }
  });

nock('https://someanotherurl.com').post('/token')
  .reply(400, () => {
    return {}
  });

module.exports = function(app, template, hook) {
  if (!app.formio) {
    return;
  }

  describe('oAuth M2M Token Tests', function(){
    let oauthSettings;
    let token;

    beforeEach(function(done) {
      app.formio.config.enableOauthM2M = true;
      done();
    });

    after(function(done) {
      app.formio.config.enableOauthM2M = false;
      done();
    });

    describe('Bootstrap', function() {

      it('Check M2M settings', function(done) {
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

           assert(oauthSettings.oauthM2M);
           assert(oauthSettings.oauthM2M.clientId);
           assert(oauthSettings.oauthM2M.clientSecret);
           assert(oauthSettings.oauthM2M.tokenURI);

           // Store the JWT for future API calls.
           template.formio.owner.token = res.headers['x-jwt-token'];

           done();
          });
      });
    });

    describe ('get M2M Token', function() {
      beforeEach(function(done) {
        app.formio.config.enableOauthM2M = true;
        done();
      });
      it('Check if the M2M token recieves', function(done) {
        request(app)
          .get(hook.alter('url', '/current', template))
          .set('x-jwt-token', template.users.user1.token)
          .expect(200)
          .end(function(err, res) {
              if (err) {
                return done(err);
              }
              const response = res.body;

              assert(res.headers.hasOwnProperty('x-m2m-token'), 'The response should contain a `x-m2m-token` header.');
              assert(response.hasOwnProperty('data'), 'The response should contain an `data`.');
              assert.deepEqual(res.headers['x-m2m-token'], "TEST_M2M_TOKEN");
              token = res.headers['x-jwt-token'];

              done();
            });

      })

      it('Check if M2M token is the same', function(done) {
        request(app)
          .get(hook.alter('url', '/current', template))
          .set('x-jwt-token', token)
          .expect(200)
          .end(function(err, res) {
              if (err) {
                return done(err);
              }
              const response = res.body;
              assert(res.headers.hasOwnProperty('x-m2m-token'), 'The response should contain a `x-m2m-token` header.');
              assert(response.hasOwnProperty('data'), 'The response should contain an `data`.');
              assert.deepEqual(res.headers['x-m2m-token'], "TEST_M2M_TOKEN", 'The m2m token should be the same`.');
              token = res.headers['x-jwt-token'];

              done();
            });

      })

      it('Change project settings', function(done){
        oauthSettings.oauthM2M.tokenURI = 'https://https://someanotherurl.com/token'
        request(app)
        .get('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const project = res.body;

          project.settings.oauth = oauthSettings;

          request(app)
            .put('/project/' + template.project._id)
            .set('x-jwt-token', template.formio.owner.token)
            .send(project)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            })
        })
      })

      it('The response should be OK if had an error while getting m2m token', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/current')
          .set('x-jwt-token', template.users.user1.token)
          .expect(200)
          .end(function(err, res) {
              if (err) {
                return done(err);
              }
              assert(!res.headers.hasOwnProperty('x-m2m-token'), 'The response shouldn\'t contain a `x-m2m-token` header.');
              done();
            });

      })
    })
  })
};
