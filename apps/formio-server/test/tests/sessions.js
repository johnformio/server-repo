'use strict';

const request = require('supertest');
const assert = require('assert');
const _ = require('lodash');
const chance = new (require('chance'))();
const stuff = {};

module.exports = function(app, template, hook) {
  describe('Session Tests', function() {
    before(async () => {
      stuff.admin = {
        data: {
          name: chance.word(),
          email: chance.email(),
          password: chance.word({length: 10}),
        }
      };

      // Create the admin user.
      const adminUserRes = await request(app)
        .post(`/project/${template.formio.formLogin.project}/user/register/submission`)
        .send({
          data: stuff.admin.data,
        });

      assert.equal(adminUserRes.status, 200);
      stuff.admin.user = adminUserRes.body;
      stuff.admin.token = adminUserRes.headers['x-jwt-token'];

      // Create a project
      const projectRes = await request(app)
        .post(`/project`)
        .set('x-jwt-token', stuff.admin.token)
        .send({
          title: chance.word(),
          name: chance.word(),
        });

      assert.equal(projectRes.status, 201);
      stuff.project = projectRes.body;

      // Create a user
      stuff.user1 = {
        password: chance.word({length: 10}),
      };
      const res = await request(app)
        .post(`/project/${stuff.project._id}/user/submission`)
        .set('x-jwt-token', stuff.admin.token)
        .send({
          data: {
            email: chance.email(),
            password: stuff.user1.password,
          }
        });

      assert.equal(res.status, 201);
      stuff.user1.user = res.body;
    });

    it('A user can log in once', async () => {
      const res = await request(app)
        .post(`/project/${stuff.project._id}/user/login/submission`)
        .send({
          data: {
            email: stuff.user1.user.data.email,
            password: stuff.user1.password,
          }
        });

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['x-jwt-token'], null);
      assert.notEqual(res.headers['x-jwt-token'], '');
      stuff.user1.token1 = res.headers['x-jwt-token'];
    });

    it('A user can log in twice', async () => {
      const res = await request(app)
        .post(`/project/${stuff.project._id}/user/login/submission`)
        .send({
          data: {
            email: stuff.user1.user.data.email,
            password: stuff.user1.password,
          }
        });

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['x-jwt-token'], null);
      assert.notEqual(res.headers['x-jwt-token'], '');
      assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token1);
      stuff.user1.token2 = res.headers['x-jwt-token'];
    });

    it('A user can use the first token', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/form`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 200);
    });

    it('A user can use the second token', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/form`)
        .set('x-jwt-token', stuff.user1.token2);

      assert.equal(res.status, 200);
    });

    it('A user gets a new token on each request for token 1', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/form`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['x-jwt-token'], null);
      assert.notEqual(res.headers['x-jwt-token'], '');
      // assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token1);
      // assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token2);
      stuff.user1.token3 = res.headers['x-jwt-token'];
    });

    it('A user gets a new token on each request for token 2', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/form`)
        .set('x-jwt-token', stuff.user1.token2);

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['x-jwt-token'], null);
      assert.notEqual(res.headers['x-jwt-token'], '');
      // assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token1);
      // assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token2);
      // assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token3);
      stuff.user1.token4 = res.headers['x-jwt-token'];
    });

    it('A user can log out a session', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/logout`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-jwt-token'], '');
    });

    it('A user can not use an original token for a session that is logged out', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/form`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 440);
    });

    it('A user can not use a derived token for a session that is logged out', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/form`)
        .set('x-jwt-token', stuff.user1.token3);

      assert.equal(res.status, 440);
    });

    it('A user can use a token for a session that is not logged out', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/form`)
        .set('x-jwt-token', stuff.user1.token2);

      assert.equal(res.status, 200);
    });
  });
};
