'use strict';

const assert = require('assert');
const request = require('supertest');

module.exports = (app, template, hook) => {
  describe('PDF Proxy', () => {
    it('Will not error out if there is no projectId', (done) => {
      request(app)
        .get('/pdf-proxy/pdf/thisProjectDoesNotExist')
        .set('x-jwt-token', template.formio.owner.token)
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.message === 'No project found.');
          done();
        })
    });
  });
};
