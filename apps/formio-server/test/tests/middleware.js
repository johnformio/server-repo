/* eslint-env mocha */
'use strict';

const assert = require('assert');
const _ = require('lodash');
const attachLicenseMiddleware = require('../../src/middleware/attachLicenseTerms');

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
    });
  });
};
