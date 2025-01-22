/* eslint-env mocha */
'use strict';

const assert = require('assert');
const _ = require('lodash');
const attachLicenseMiddleware = require('../../src/middleware/attachLicenseTerms');
const request = require('supertest');
const sinon = require('sinon');

module.exports = (app, template, hook) => {
  describe('Middleware unit tests', () => {
    describe('attachLicense Middleware', () => {
      describe('Middleware creation', () => {
        let middleware;
        beforeEach(() => {
          middleware = attachLicenseMiddleware(app);
        });

        it('Should return a function', function() {
          assert(typeof middleware === 'function');
        });

        it('Should accept three arguments', function() {
          assert(middleware.length === 3);
        });
      });

      describe('Request object mutation', () => {
        it('Should attach license terms on successful license validation', async function() {
          const middleware = attachLicenseMiddleware(Promise.resolve(), app);
          let req = {};
          let res = {};
          const next = () => {};

          await middleware(req, res, next);
          assert(req.hasOwnProperty('licenseTerms'));
          assert(req.licenseTerms.hasOwnProperty('options'));
          assert(req.licenseTerms.options.hasOwnProperty('sac'));
        });

        it('Should not mutate the request object on unsuccessful license validation', async function() {
          const middleware = attachLicenseMiddleware(Promise.reject(), app);
          let req = {};
          let res = {};
          const next = () => {};

          await middleware(req, res, next);
          assert(_.isEmpty(req));
        });
      });

      describe('Captcha', () => {
        let reCaptchaTestProject = null;
        let captchaTestProject = null;
        let noSecretKeyProject = null;
        before('Setup a captcha project', async ()=> {
          const recaptchaProjectRequest = {
            title: 'Recaptcha Project',
            type: 'project',
            plan: 'commercial',
            settings: {
              recaptcha: {
                siteKey: 'randomsitekey',
                secretKey: 'randomsecretkey'
              }
            }
          }
          const captchaProjectRequest = {
            title: 'Captcha Project',
            type: 'project',
            plan: 'commercial',
            settings: {
              captcha: {
                siteKey: 'randomsitekey',
                secretKey: 'randomsecretkey'
              }
            }
          }

          const captchaProjectWithoutSecretKey = {
            title: 'Captcha Project Without Secret Key',
            type: 'project',
            plan: 'commercial',
            settings: {
              recaptcha: {
                siteKey: 'randomsitekey'
              }
            }
          }
          // Create two projects for Google and cloudflare captcha testing
          const recaptchaResponse = await request(app)
            .post('/project')
            .set('x-jwt-token', template.formio.owner.token)
            .send(recaptchaProjectRequest)
          assert.equal(recaptchaResponse.status, 201)
          template.formio.owner.token = recaptchaResponse.headers['x-jwt-token'];
          reCaptchaTestProject = recaptchaResponse.body;
          const captchaResponse = await request(app)
            .post('/project')
            .set('x-jwt-token', template.formio.owner.token)
            .send(captchaProjectRequest)
          assert.equal(captchaResponse.status, 201);
          captchaTestProject = captchaResponse.body;
          const captchaWithoutSecretKeyResponse = await request(app)
            .post('/project')
            .set('x-jwt-token', template.formio.owner.token)
            .send(captchaProjectWithoutSecretKey)
          assert.equal(captchaWithoutSecretKeyResponse.status, 201);
          noSecretKeyProject = captchaWithoutSecretKeyResponse.body;
        })

        it('Should make a request to www.google.com/recaptcha if captchaType is recaptcha', (done) => {
          request(app)
            .get(`/project/${reCaptchaTestProject._id}/captcha?captchaToken=123&captchaType=recaptcha`)
            .set('x-jwt-token', template.formio.owner.token)
            .end((err, res)=>{
              assert.equal(res.body.url, 'https://www.google.com/recaptcha/api/siteverify')
              done();
            });
        });

        it('Should make a request to https://challenges.cloudflare.com/turnstile/v0/siteverify if captchaType is captcha', (done) => {
          request(app)
            .get(`/project/${captchaTestProject._id}/captcha?captchaToken=123&captchaType=captcha`)
            .set('x-jwt-token', template.formio.owner.token)
            .end((err, res) => {
              assert.equal(res.body.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
              done();
            })
        });

        it('Should respond with 400 status code if not given a captchaToken', (done) => {
          request(app)
            .get(`/project/${reCaptchaTestProject._id}/captcha?captchaType=recaptcha`)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(400)
            .end((err, res) => {
              if(err) throw err;
              done();
            });
        });

        it('Should respond with 400 status code if secret key is not set', (done) => {
          request(app)
            .get(`/project/${noSecretKeyProject._id}/captcha?captchaToken=123&captchaType=recaptcha`)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(400)
            .end((err, res) => {
              if(err) throw err;
              done();
            })
        });
      })
    });
  });
};
