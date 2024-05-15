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
      const adminUserResFirst = await request(app)
        .post(`/project/${template.formio.formLogin.project}/user/register/submission`)
        .send({
          data: stuff.admin.data,
        });

        stuff.admin.token = await new Promise((resolve) => {
        const event = template.hooks.getEmitter();
        event.once('newMail', (email) => {
          var regex = /(?<=token=)[^"]+/i;
          var token = email.html.match(regex);
          token = token ? token[0] : token;
          resolve(token);
        });
      })

      assert.equal(adminUserResFirst.status, 201);
      stuff.admin.user = adminUserResFirst.body;
      // Verify account
      const adminUserRes = await request(app)
          .put(`/project/${template.formio.formLogin.project}/user/submission/${stuff.admin.user._id}`)
          .set('x-jwt-token',  stuff.admin.token)
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
          type: 'project'
        });

      assert.equal(projectRes.status, 201);
      stuff.project = projectRes.body;

      const rolesRes = await request(app)
        .get(`/project/${stuff.project._id}/role`)
        .set('x-jwt-token', stuff.admin.token);

      const roles = rolesRes.body.reduce((prev, role) => {prev[role.title.toLowerCase()] = role._id; return prev;}, {});

       //Sets permissions to read all for the project to all roles.
       await request(app)
       .put(`/project/${stuff.project._id}`)
       .set("x-jwt-token", stuff.admin.token)
       .send({
         access: [
           {
             type: "create_all",
             roles: [roles.administrator],
           },
           {
             type: "read_all",
             roles: [
               roles.administrator,
               roles.authenticated,
               roles.anonymous
             ],
           },
           {
             type: "update_all",
             roles: [roles.administrator],
           },
           {
             type: "delete_all",
             roles: [roles.administrator],
           },
         ],
       })

      // Set owner permissions on user
      const permRes = await request(app)
        .put(`/project/${stuff.project._id}/user`)
        .set('x-jwt-token', stuff.admin.token)
        .send({
          submissionAccess: [
            {
              type: 'read_all',
              roles: [roles.administrator],
            },
            {
              type: 'update_all',
              roles: [roles.administrator],
            },
            {
              type: 'delete_all',
              roles: [roles.administrator],
            },
            {
              type: 'create_all',
              roles: [roles.administrator],
            },
            {
              type: 'read_own',
              roles: [roles.authenticated],
            },
            {
              type: 'update_own',
              roles: [roles.authenticated],
            },
            {
              type: 'delete_own',
              roles: [roles.authenticated],
            },
            {
              type: 'create_own',
              roles: [roles.authenticated],
            },
            {
              type: 'self',
              roles: []
            }
          ],
        });
      assert.equal(permRes.status, 200);

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
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 200);
    });

    it('A user can use the second token', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token2);

      assert.equal(res.status, 200);
    });

    it('A user gets a new token on each request for token 1', async () => {
      // Wait one second so the iat is not the same and the token will be unique.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['x-jwt-token'], null);
      assert.notEqual(res.headers['x-jwt-token'], '');
      assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token1);
      assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token2);
      stuff.user1.token3 = res.headers['x-jwt-token'];
    });

    it('A user gets a new token on each request for token 2', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token2);

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['x-jwt-token'], null);
      assert.notEqual(res.headers['x-jwt-token'], '');
      assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token1);
      assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token2);
      assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token3);
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
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 440);
    });

    it('A user can not use a derived token for a session that is logged out', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token3);

      assert.equal(res.status, 440);
    });

    it('A user can use a token for a session that is not logged out', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token2);

      assert.equal(res.status, 200);
    });

    it('A user can use a derived token for a session that is not logged out', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token4);

      assert.equal(res.status, 200);
    });

    it('A user can log in again', async () => {
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

    it('A user gets a new token on each request for token 1 again', async () => {
      // Wait one second so the iat is not the same and the token will be unique.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['x-jwt-token'], null);
      assert.notEqual(res.headers['x-jwt-token'], '');
      assert.notEqual(res.headers['x-jwt-token'], stuff.user1.token1);
      stuff.user1.token3 = res.headers['x-jwt-token'];
    });

    it('A user can change their password', async () => {
      stuff.user1.password = chance.word({length: 10});
      const res = await request(app)
        .put(`/project/${stuff.project._id}/user/submission/${stuff.user1.user._id}`)
        .set('x-jwt-token', stuff.user1.token1)
        .send({
          data: {
            email: stuff.user1.user.data.email,
            password: stuff.user1.password,
          }
        });

      assert.equal(res.status, 200);
    });

    it('Existing tokens for a session still work', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token1);

      assert.equal(res.status, 200);
    });

    it('A user can not use an original token for a session when password has been changed', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token2);

      assert.equal(res.status, 440);
    });

    it('A user can not use a derived token for a session when password has been changed', async () => {
      const res = await request(app)
        .get(`/project/${stuff.project._id}/current`)
        .set('x-jwt-token', stuff.user1.token4);

      assert.equal(res.status, 440);
    });
  });
};
