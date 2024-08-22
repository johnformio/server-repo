 /* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var chance = new (require('chance'))();
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;

module.exports = function(app, template, hook) {
  // Don't run for docker.
  if (docker) {
    return;
  }
  var ignoreFields = ['config', 'disabled', 'plan'];
  let teamProject = null;
  const cache = require('../../src/cache/cache')(app.formio);
  describe('Teams', function() {

    // For verify email
    const getVerificationToken = function () {
      return new Promise((resolve) => {
        const event = template.hooks.getEmitter();
        event.once('newMail', (email) => {
          const regex = /(?<=token=)[^"]+/i;
          let token = email.html.match(regex);
          token = token ? token[0] : token;
          resolve(token);
        });
      });
    }

    const verifyUser = function(user, done) {
      return new Promise((resolve) => {
        request(app)
        .put('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + user._id)
        .set('x-jwt-token', user.token)
        .send({
          data: {
            'name': user.data.name,
            'email': user.data.email,
            'password': user.data.password
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Update our testProject.owners data.
          const response = res.body;
          const tempPassword = user.data.password;
          user = response;
          user.data.password = tempPassword;

          // Store the JWT for future API calls.
          user.token = res.headers['x-jwt-token'];
          resolve(user);
        });
      });
    };

    describe('Single Team Tests', function() {
      it('Should register a new Form.io user', (done) => {
        let tempPassword = chance.word({ length: 8 });
        template.formio.teamAdmin = {
          data: {
            name: chance.word(),
            email: chance.email(),
          }
        }
        getVerificationToken()
          .then((token) => {
            template.formio.teamAdmin.token = token;
            return verifyUser(template.formio.teamAdmin, done);
          })
          .then((user) => {
            template.formio.teamAdmin = _.cloneDeep(user);
            done();
          });

        request(app)
          .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
          .send(template.formio.teamAdmin)
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            template.formio.teamAdmin = response;
            template.formio.teamAdmin.data.password = tempPassword;
          });
      });

      it('Register another Formio User', function(done) {
        let tempPassword = 'test12345';
        template.formio.user1 = {
          data: {
            'name': chance.word({ length: 10 }),
            'email': chance.email(),
          }
        }
        getVerificationToken()
          .then((token) => {
            template.formio.user1.token = token;
            return verifyUser(template.formio.user1, done);
          })
          .then((user) => {
            template.formio.user1 = _.cloneDeep(user);
            done();
          });

        request(app)
          .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
          .send(template.formio.user1)
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            template.formio.user1 = response;
            template.formio.user1.data.password = tempPassword;
          });
      });

      it('Register another Formio User 3 not on a team', function(done) {
        let tempPassword = 'test12345';
        template.formio.user3 = {
          data: {
            'name': chance.word({ length: 10 }),
            'email': chance.email(),
          }
        }

        getVerificationToken()
          .then((token) => {
            template.formio.user3.token = token;
            return verifyUser(template.formio.user3, done);
          })
          .then((user) => {
            template.formio.user3 = _.cloneDeep(user);
            done();
          });

        request(app)
          .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
          .send(template.formio.user3)
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            template.formio.user3 = response;
            template.formio.user3.data.password = tempPassword;
          });
      });

      it('Register another Formio User 4', function(done) {
        let tempPassword = 'test12345';
        template.formio.user4 = {
          data: {
            'name': chance.word({ length: 10 }),
            'email': chance.email(),
          }
        }

        getVerificationToken()
          .then((token) => {
            template.formio.user4.token = token;
            return verifyUser(template.formio.user4, done);
          })
          .then((user) => {
            template.formio.user4 = _.cloneDeep(user);
            done();
          });

        request(app)
          .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
          .send(template.formio.user4)
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            template.formio.user4 = response;
            template.formio.user4.data.password = tempPassword;
          });
      });

      it('A Formio User should be able to access the Team Form', function(done) {
          request(app)
            .get('/project/' + template.formio.project._id + '/form/' + template.formio.teamResource._id)
            .set('x-jwt-token', template.formio.teamAdmin.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              // Store the JWT for future API calls.
              template.formio.teamAdmin.token = res.headers['x-jwt-token'];

              done();
            });
      });

      it('An anonymous user should NOT be able to create a team.', (done) => {
        request(app)
          .post('/team')
          .send({
            data: {
              name: chance.word()
            }
          })
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('An outside user should NOT be able to create a team.', (done) => {
        request(app)
          .post('/team')
          .set('x-jwt-token', template.users.user1.token)
          .send({
            data: {
              name: chance.word()
            }
          })
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('A Formio User should be able to create a Team without users', function(done) {
        request(app)
          .post('/team')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              name: chance.word()
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            // Store the team reference for later.
            template.team1 = res.body;

            done();
          });
      });

      it('Should return 404 for invalid ObjectId', (done) => {
        request(app)
        .get('/team/' + "INVALID_ID")
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .expect(404)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text, 'Could not find the team');

          done();
        });
      });

      it('Should have added the team owner as an admin member', (done) => {
        request(app)
        .get('/team/' + template.team1._id)
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.data.admins.length, 1);
          assert.equal(response.data.members.length, 0);
          assert.equal(response.data.admins[0].data.email, template.formio.teamAdmin.data.email);

          // Store the JWT for future API calls.
          template.formio.teamAdmin.token = res.headers['x-jwt-token'];
          done();
        });
      });

      it('The Team Owner should be able to add a Formio user', (done) => {
        request(app)
        .post('/team/' + template.team1._id + '/member')
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .send({
          data: {
            userId: template.formio.user1._id,
            email: template.formio.user1.data.email,
            admin: false
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('The Team Owner should not be able to add Formio user with duplicate email', (done) => {
        request(app)
        .post(`/team/${template.team1._id}/member`)
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .send({
          data: {
            userId: template.formio.user1._id,
            email: template.formio.user1.data.email,
            admin: false
          }
        })
        .expect('Content-Type', /text/)
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('The Team Owner should be able to add an outside user', (done) => {
        request(app)
        .post('/team/' + template.team1._id + '/member')
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .send({
          data: {
            userId: template.users.user1._id,
            email: template.users.user1.data.email,
            admin: false
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('The Team Owner should not be able to add an outside user with duplicate email', (done) => {
        request(app)
        .post('/team/' + template.team1._id + '/member')
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .send({
          data: {
            userId: template.users.user1._id,
            email: template.users.user1.data.email,
            admin: false
          }
        })
        .expect('Content-Type', /text/)
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      let outsideMember = null;
      let formioMember = null;
      it('The Team should now have two members.', function(done) {
        request(app)
          .get('/team/' + template.team1._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.data.members.length, 2);
            assert.equal(response.data.members[0].data.email, template.formio.user1.data.email);
            assert.equal(response.data.members[1].data.email, template.users.user1.data.email);
            formioMember = response.data.members[0].memberId;
            outsideMember = response.data.members[1].memberId;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('A team user can get the team info.', function(done) {
        request(app)
          .get('/team/' + template.team1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.data.members.length, 2);
            template.formio.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('An outside team user can NOT get the team info.', function(done) {
        request(app)
          .get('/team/' + template.team1._id)
          .set('x-jwt-token', template.users.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An outside Team member should not be able to update the Team', function(done) {
        request(app)
          .put('/team/' + template.team1._id)
          .set('x-jwt-token', template.users.user1.token)
          .send({
            data: {
              name: template.team1.data.name
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An outside Team member should not be able to update their membership', (done) => {
        request(app)
        .put('/team/' + template.team1._id + '/member/' + outsideMember)
        .send({
          data: {
            userId: template.users.user1._id,
            admin: true
          }
        })
        .set('x-jwt-token', template.users.user1.token)
        .expect('Content-Type', /text/)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('An outside Team member should not be able to update others membership', (done) => {
        request(app)
        .put('/team/' + template.team1._id + '/member/' + formioMember)
        .send({
          data: {
            userId: template.formio.user1._id,
            admin: true
          }
        })
        .set('x-jwt-token', template.users.user1.token)
        .expect('Content-Type', /text/)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('An inside Team member should not be able to delete any membership', (done) => {
        request(app)
        .delete('/team/' + template.team1._id + '/member/' + outsideMember)
        .set('x-jwt-token', template.formio.user1.token)
        .expect('Content-Type', /text/)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('An inside Team member should not be able to delete their membership', (done) => {
        request(app)
        .delete('/team/' + template.team1._id + '/member/' + formioMember)
        .set('x-jwt-token', template.formio.user1.token)
        .expect('Content-Type', /text/)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('An outside Team member should not be able to delete their membership', (done) => {
        request(app)
        .delete('/team/' + template.team1._id + '/member/' + outsideMember)
        .set('x-jwt-token', template.users.user1.token)
        .expect('Content-Type', /text/)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('An outside Team member should not be able to delete any membership', (done) => {
        request(app)
        .delete('/team/' + template.team1._id + '/member/' + formioMember)
        .set('x-jwt-token', template.users.user1.token)
        .expect('Content-Type', /text/)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('An outside Team member should not be able to update the Team via submission', function(done) {
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.teamResource._id + '/submission/' + template.team1._id)
          .set('x-jwt-token', template.users.user1.token)
          .send({
            data: {
              name: template.team1.data.name
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An inside Team member should not be able to update the Team via submission', function(done) {
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.teamResource._id + '/submission/' + template.team1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              name: template.team1.data.name
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An inside Team member should not be able to update the membership via submission', function(done) {
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.memberResource._id + '/submission/' + formioMember)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              admin: true
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An outside Team member should not be able to update the membership via submission', function(done) {
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.memberResource._id + '/submission/' + outsideMember)
          .set('x-jwt-token', template.users.user1.token)
          .send({
            data: {
              admin: true
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('A Form.io Team member should not be able to update the Team', function(done) {
        request(app)
          .put('/team/' + template.team1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              name: template.team1.data.name
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('A Team owner should be able to update the Team', function(done) {
        request(app)
          .put('/team/' + template.team1._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              name: template.team1.data.name
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An outside Team member should not be able to update the membership via submission', function(done) {
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.memberResource._id + '/submission/' + outsideMember)
          .set('x-jwt-token', template.users.user1.token)
          .send({
            data: {
              admin: true
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An outside Team member should not be able to update the Team', function(done) {
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.teamResource._id + '/submission/' + template.team1._id)
          .set('x-jwt-token', template.users.user1.token)
          .send({
            data: {
              name: template.team1.data.name
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An outside Team member should not be able to delete the Team', function(done) {
        request(app)
          .delete('/project/' + template.formio.project._id + '/form/' + template.formio.teamResource._id + '/submission/' + template.team1._id)
          .set('x-jwt-token', template.users.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('A Form.io Team member should not be able to delete the Team', function(done) {
        request(app)
          .delete('/project/' + template.formio.project._id + '/form/' + template.formio.teamResource._id + '/submission/' + template.team1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('An outside Team member should NOT see the Team when they request /team/all', function(done) {
        request(app)
          .get('/team/all')
          .set('x-jwt-token', template.users.user1.token)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('A Form.io Team member should see the Team when they request /team/all', function(done) {
        request(app)
          .get('/team/all')
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, template.team1._id);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member should not see the Team when they request /team/own', function(done) {
        request(app)
          .get('/team/own')
          .set('x-jwt-token', template.users.user1.token)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('A Form.io Team member should not see the Team when they request /team/own', function(done) {
        request(app)
          .get('/team/own')
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 0);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team owner should see their Team when they request /team/all', function(done) {
        request(app)
          .get('/team/all')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, template.team1._id);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team owner should see their Team when they request /team/own', function(done) {
        request(app)
          .get('/team/own')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, template.team1._id);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Form.io user can create a new project', (done) => {
        request(app)
        .post('/project')
        .send({
          title: chance.word(),
          description: chance.sentence(),
          template: _.pick(template, ['title', 'name', 'version', 'description', 'roles', 'resources', 'forms', 'actions', 'access']),
          type: 'project'
        })
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          teamProject = res.body;
          template.formio.teamAdmin.token = res.headers['x-jwt-token'];
          done();
        });
      });

      it('Upgrade the project to a team project plan', async function() {
        const project = await cache.updateProject(teamProject._id, {plan: 'team'});
        teamProject = project;
      });

      it('A Project Owner should be able to add a Team they own to their project, if its on a team plan', function(done) {
        var teamAccess = {type: 'team_read', roles: [template.team1._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access = oldResponse.access.concat(teamAccess);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: oldResponse.access.concat(teamAccess) })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                // Confirm that the team role not added to the projects permissions.
                var response = res.body;
                var found = false;
                response.access.forEach(function(element) {
                  if(element.type === 'team_read') {
                    found = true;
                    assert.notEqual(template.team1._id, null);
                    assert.notEqual(template.team1._id, '');
                    assert.deepEqual(element, teamAccess);
                  }
                });
                assert.equal(found, true);

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      it('A Team Owner should be able to access /team/project/:projectId to see all the teams associated with the project', function(done) {
        request(app)
          .get('/team/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, template.team1._id);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project Owner should be able to access /team/:teamId/projects to see all the projects associated with this team', function(done) {
        request(app)
          .get('/team/' + template.team1._id + '/projects')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, teamProject._id);
            assert.equal(response[0].title, teamProject.title);
            assert.equal(response[0].name, teamProject.name);
            assert.equal(response[0].owner, teamProject.owner);
            assert.equal(response[0].permission, 'team_read');

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('An outside Team member should NOT be able to see projects related to the team when accessing /projects', function(done) {
        request(app)
          .get('/project')
          .set('x-jwt-token', template.users.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('A Form.io Team member should not be able to see projects related to the team when accessing /projects', function(done) {
        request(app)
          .get('/project')
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response instanceof Array, true);
            assert.equal(response.length, 0);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Form.io Team member must accept the team invite before seeing the project', function(done) {
        template.formio.user1.metadata = {
          teams: [template.team1._id.toString()]
        };
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send(template.formio.user1)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            template.formio.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('A Form.io Team member should be able to see projects related to the team when accessing /projects', function(done) {
        request(app)
          .get('/project')
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response instanceof Array, true);
            assert.notEqual(response.length, 0);
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, teamProject._id);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('An outside Team member should NOT be able to access /team/:teamId/projects to see all the projects associated with this team', function(done) {
        request(app)
          .get('/team/' + template.team1._id + '/projects')
          .set('x-jwt-token', template.users.user1.token)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('A Form.io Team member should be able to access /team/:teamId/projects to see all the projects associated with this team', function(done) {
        request(app)
          .get('/team/' + template.team1._id + '/projects')
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, teamProject._id);
            assert.equal(response[0].title, teamProject.title);
            assert.equal(response[0].name, teamProject.name);
            assert.equal(response[0].owner, teamProject.owner);
            assert.equal(response[0].permission, 'team_read');

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('An anonymous user should NOT be able to access /team/:teamId/projects to see all the projects associated with this team', function(done) {
        request(app)
          .get('/team/' + template.team1._id + '/projects')
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('Upgrade the project to a commercial project plan', async function() {
        const project = await cache.updateProject(teamProject._id, {plan: 'commercial'});
        teamProject = project;
      });

      it('A Project Owner should be able to add a Team they own to their project, if its on a commercial plan', function(done) {
        var teamAccess = {type: 'team_read', roles: [template.team1._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access = oldResponse.access.concat(teamAccess);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: oldResponse.access.concat(teamAccess) })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                // Confirm that the team role was added to the projects permissions.
                var response = res.body;
                var found = false;
                response.access.forEach(function(element) {
                  if(element.type === 'team_read') {
                    found = true;
                    assert.notEqual(template.team1._id, null);
                    assert.notEqual(template.team1._id, '');
                    assert.deepEqual(element, teamAccess);
                  }
                });
                assert.equal(found, true);

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      it('Upgrade the project to a commercial project plan', async function() {
        const project = await cache.updateProject(teamProject._id, {plan: 'trial'});
        teamProject = project;
      });

      it('A Project Owner should be able to add a Team they own to their project, if its on a commercial plan', function(done) {
        var teamAccess = {type: 'team_read', roles: [template.team1._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access = oldResponse.access.concat(teamAccess);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: oldResponse.access.concat(teamAccess) })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                // Confirm that the team role was added to the projects permissions.
                var response = res.body;
                var found = false;
                response.access.forEach(function(element) {
                  if(element.type === 'team_read') {
                    found = true;
                    assert.notEqual(template.team1._id, null);
                    assert.notEqual(template.team1._id, '');
                    assert.deepEqual(element, teamAccess);
                  }
                });
                assert.equal(found, true);

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      it('Revert the project to a team project plan', async function() {
        const project = await cache.updateProject(teamProject._id, {plan: 'team'});
        teamProject = project;
      });

      it('A Project Owner should be able to remove a team from their project', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            var oldAccess = _.clone(oldResponse.access);
            var newAccess = _.filter(oldAccess, function(permission) {
              if (permission.type && !_.startsWith(permission.type, 'team_')) {
                return permission;
              }
            });

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: newAccess })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var response = res.body;
                assert.notEqual(oldAccess.length, newAccess.length);
                assert.equal(oldAccess.length, (newAccess.length + 1));

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      it('An outside Team member should NOT be able to remove themselves from the Team', function(done) {
        request(app)
          .post('/team/' + template.team1._id + '/leave')
          .set('x-jwt-token', template.users.user1.token)
          .send()
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Form.io user should have the team id in the users metadata', (done) => {
        request(app)
          .get('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            var response = res.body;
            assert(_.get(response, 'metadata.teams', []).indexOf(template.team1._id.toString()) !== -1, 'Should have the team in metadata.');
            template.formio.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });

       it('A Form.io Team member should be able to remove themselves from the Team', function(done) {
        request(app)
          .post('/team/' + template.team1._id + '/leave')
          .set('x-jwt-token', template.formio.user1.token)
          .send()
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should have removed the team from the users metadata', (done) => {
        request(app)
          .get('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            var response = res.body;
            assert(_.get(response, 'metadata.teams', []).indexOf(template.team1._id.toString()) === -1, 'Should have removed the team.');
            template.formio.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('A Team admin should be able to remove erroneous users.', function(done) {
        request(app)
          .delete('/team/' + template.team1._id + '/member/' + outsideMember)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send()
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team admin should be able to add teams to a project.', function(done) {
        request(app)
          .get('/team/own')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send()
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('The Team should not have any members, after the final user leaves.', function(done) {
        request(app)
          .get('/team/' + template.team1._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.data.members.length, 0);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            // Update the team reference for later.
            template.team1 = response;

            done();
          });
      });

      it("Should register user with special characters in email", done => {
        const tempPassword = chance.word({ length: 8 });
        const specialSymbols = "+-._~!$&'*=";
        const email = `test${specialSymbols}${chance.email()}`;

        template.formio.user4 = {
          data: {
            name: chance.word({ length: 10 }),
            email: email,
          },
        };

        getVerificationToken()
          .then((token) => {
            template.formio.user4.token = token;
            return verifyUser(template.formio.user4, done);
          })
          .then((user) => {
            template.formio.user4 = _.cloneDeep(user);
            done();
          });

        request(app)
          .post(
            "/project/" +
              template.formio.project._id +
              "/form/" +
              template.formio.formRegister._id +
              "/submission"
          )
          .send(template.formio.user4)
          .expect(201)
          .expect("Content-Type", /json/)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const user = res.body;

            assert.ok(user._id);
            assert.ok(user.data);
            assert.equal(user.data.email, email);

            template.formio.user4 = user;
            template.formio.user4.data.password = tempPassword;
          });
      });

      it("Should allow user with special characters in email to be added to a team", done => {
        request(app)
          .post("/team/" + template.team1._id + "/member")
          .set("x-jwt-token", template.formio.teamAdmin.token)
          .send({
            data: {
              userId: template.formio.user4._id,
              email: template.formio.user4.data.email,
              admin: false,
            },
          })
          .expect("Content-Type", /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const submission = res.body;

            assert.ok(submission._id);
            assert.ok(submission.data);
            assert.equal(submission.data.email, template.formio.user4.data.email);
            assert.equal(submission.data.team._id, template.team1._id);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers["x-jwt-token"];

            done();
          });
      });

      it("Should return the teams of the user with special characters in email", done => {
        request(app)
          .get("/team/all")
          .set("x-jwt-token", template.formio.user4.token)
          .expect("Content-Type", /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const userTeams = res.body;
            assert.equal(userTeams.length, 1);
            assert.equal(userTeams[0]._id, template.team1._id);

            done();
          });
      });
    });

    describe('Multi Team Tests', function() {
      if (docker) {
        return;
      }

      let testTeamProject = null;
      it('Create another project', function(done) {
        request(app)
          .post('/project')
          .send({
            title: chance.word(),
            description: chance.sentence(),
            type: 'project'
          })
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            testTeamProject = response;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create another Team', function(done) {
        request(app)
          .post('/team')
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              name: chance.word(),
              members: []
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Store the team reference for later.
            template.team2 = response;

            done();
          });
      });

      it('Create another Team 3', function(done) {
        request(app)
          .post('/team')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              name: chance.word(),
              members: []
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            // Store the team reference for later.
            template.team3 = response;

            done();
          });
      });

      it('A Team Owner should not be able to edit a team they do not own', function(done) {
        request(app)
          .put('/team/' + template.team1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              name: template.team2.data.name
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team Owner should not be able to delete a team they do not own', function(done) {
        request(app)
          .delete('/team/' + template.team1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project Owner should not be able to add a Team they do not own to their project', function(done) {
        var teamAccess = {type: 'team_read', roles: [template.team1._id]};

        request(app)
          .get('/project/' + testTeamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access.push(teamAccess);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + testTeamProject._id)
              .set('x-jwt-token', template.formio.user1.token)
              .send(oldResponse)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var found = false;

                // Confirm that the project wasn't modified.
                var response = res.body;
                (response.access || []).forEach(function(permission) {
                  if (permission.type === 'team_read') {
                    found = permission;
                  }
                });

                if (found !== false) {
                  assert.deepEqual(found.roles, []);
                }

                testTeamProject = response;

                // Store the JWT for future API calls.
                template.formio.user1.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      let user1Member = null;
      it('Should allow user1 to be added to a team', (done) => {
        request(app)
          .post('/team/' + template.team1._id + '/member')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              userId: template.formio.user1._id,
              email: template.formio.user1.data.email,
              admin: false
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            user1Member = res.body;
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user3 to be added to a team', (done) => {
        request(app)
          .post('/team/' + template.team1._id + '/member')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              userId: template.formio.user3._id,
              email: template.formio.user3.data.email,
              admin: false
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user4 to be added to a team', (done) => {
        request(app)
          .post('/team/' + template.team3._id + '/member')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              userId: template.formio.user4._id,
              email: template.formio.user4.data.email,
              admin: false
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user1 to accept this team.', (done) => {
        template.formio.user1.metadata = {
          teams: [template.team1._id.toString()]
        };
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send(template.formio.user1)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            template.formio.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('Should allow user4 to accept this team.', (done) => {
        template.formio.user4.metadata = {
          teams: [template.team3._id.toString()]
        };
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user4._id)
          .set('x-jwt-token', template.formio.user4.token)
          .send(template.formio.user4)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            template.formio.user4.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('A Team Owner should be able to delete a team they do own', function(done) {
        request(app)
          .delete('/team/' + template.team3._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /text/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Make sure that user who is a member of the deleted team does not cause server-side errors', (done) => {
        request(app)
          .get('/team/all')
          .set('x-jwt-token', template.formio.user4.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('Make sure that the deleted team does not cause server-side errors', (done) => {
        request(app)
          .get(`/team/${template.team3._id}`)
          .set('x-jwt-token', template.formio.user4.token)
          .expect('Content-Type', /text/)
          .expect(404)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('Should allow user1 to add a team he is a member of to a project they own.', (done) => {
        var teamAccess = {type: 'team_read', roles: [template.team1._id]};
        request(app)
          .get('/project/' + testTeamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access.push(teamAccess);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + testTeamProject._id)
              .set('x-jwt-token', template.formio.user1.token)
              .send(oldResponse)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var found = false;

                // Confirm that the project wasn't modified.
                var response = res.body;
                (response.access || []).forEach(function(permission) {
                  if (permission.type === 'team_read') {
                    found = permission;
                  }
                });

                if (found !== false) {
                  assert.deepEqual(found.roles, [template.team1._id]);
                }

                testTeamProject = response;

                // Store the JWT for future API calls.
                template.formio.user1.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      it('Should not allow user1 make themself an admin of the team.', (done) => {
        request(app)
          .put('/team/' + template.team1._id + '/member/' + user1Member._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            _id: user1Member._id.toString(),
            data: {
              userId: template.users.user1._id,
              email: template.users.user1.data.email,
              admin: true
            }
          })
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should allow user1 to be added as an admin for a team', (done) => {
        request(app)
          .put('/team/' + template.team1._id + '/member/' + user1Member._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            _id: user1Member._id.toString(),
            data: {
              userId: template.users.user1._id,
              email: template.users.user1.data.email,
              admin: true
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('Should not allow user1 to add a team he is a member of to a project they own.', (done) => {
        var teamAccess = {type: 'team_admin', roles: [template.team1._id]};
        request(app)
          .get('/project/' + testTeamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access.push(teamAccess);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + testTeamProject._id)
              .set('x-jwt-token', template.formio.user1.token)
              .send(oldResponse)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var found = false;

                // Confirm that the project wasn't modified.
                var response = res.body;
                (response.access || []).forEach(function(permission) {
                  if (permission.type === 'team_admin') {
                    found = permission;
                  }
                });

                if (found !== false) {
                  assert.deepEqual(found.roles, [template.team1._id]);
                }

                testTeamProject = response;

                // Store the JWT for future API calls.
                template.formio.user1.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });
    });

    var testRole = null;
    var testForm = null;
    var testTeam = null;
    var testSubmission = null;
    var testTeamMember = null;
    describe('Permissions test bootstrap', function() {
      it('Create a new team', (done) => {
        request(app)
        .post('/team')
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .send({
          data: {
            name: chance.word()
          }
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Store the JWT for future API calls.
          template.formio.teamAdmin.token = res.headers['x-jwt-token'];

          // Store the team reference for later.
          testTeam = res.body;

          done();
        });
      });

      it('Add a member to the test team', function(done) {
        // Add a member to the team for the permission tests.
        request(app)
          .post('/team/' + testTeam._id + '/member')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              userId: template.formio.user1._id,
              email: template.formio.user1.data.email,
              admin: false
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            // Update the team reference for later.
            testTeamMember = res.body;

            done();
          });
      });

      it('Make sure this user belongs to the team', (done) => {
        request(app)
        .get('/team/' + testTeam._id)
        .set('x-jwt-token', template.formio.teamAdmin.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.data.members.length, 1);
          assert.equal(response.data.members[0]._id, template.formio.user1._id);

          // Store the JWT for future API calls.
          template.formio.teamAdmin.token = res.headers['x-jwt-token'];

          // Update the team reference for later.
          testTeam = response;

          done();
        });
      });

      it('Make sure the team is not yet added to the user metadata', (done) => {
        request(app)
        .get('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user1._id)
        .set('x-jwt-token', template.formio.user1.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert(_.get(response, 'metadata.teams', []).indexOf(testTeam._id.toString()) === -1, 'Should not have testTeam as a team.');
          template.formio.user1.token = res.headers['x-jwt-token'];
          done();
        });
      });

      it('Create a test role', function(done) {
        var tempRole = {
          title: chance.word(),
          description: chance.sentence()
        };

        request(app)
          .post('/project/' + teamProject._id + '/role')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send(tempRole)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            testRole = response;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a test form', function(done) {
        var tempForm = {
          title: 'Temp2 Form',
          name: 'temp2Form',
          path: 'temp2/tempform',
          type: 'form',
          access: [],
          submissionAccess: [],
          components: [
            {
              type: 'textfield',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: false
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'foo',
              key: 'foo',
              label: 'foo',
              inputMask: '',
              inputType: 'text',
              input: true
            }
          ]
        };

        request(app)
          .post('/project/' + teamProject._id + '/form')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send(tempForm)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            testForm = response;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a test submission', function(done) {
        request(app)
          .post('/project/' + teamProject._id + '/form/' + testForm._id + '/submission')
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .send({
            data: {
              foo: 'bar'
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            testSubmission = response;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('Permissions - team_read', function() {
      if (docker) {
        return;
      }

      // Bootstrap
      it('A Project Owner should be able to add one of their teams to have access with the team_read permission', function(done) {
        var teamAccess = {type: 'team_read', roles: [testTeam._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access = oldResponse.access.concat(teamAccess);

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: oldResponse.access.concat(teamAccess) })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var found = false;
                var response = res.body;
                response.access.forEach(function(element) {
                  if (element.type === 'team_read') {
                    found = true;
                    assert.notEqual(testTeam._id, null);
                    assert.notEqual(testTeam._id, '');
                    assert.deepEqual(element, teamAccess);
                  }
                });

                assert.equal(found, true);

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      // Project tests
      it('A Team member with team_read, should not be able to create a project role', function(done) {
        request(app)
          .post('/project/' + teamProject._id + '/role')
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: chance.word(),
            description: chance.sentence()
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('A non-accepted Team member with team_read, should be able to read a project role', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/role/' + testRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should allow user1 to accept this team.', (done) => {
        template.formio.user1.metadata.teams.push(testTeam._id.toString());
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user1._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send(template.formio.user1)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            template.formio.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('Make sure the team is added to the user metadata', (done) => {
        request(app)
        .get('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.user1._id)
        .set('x-jwt-token', template.formio.user1.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert(_.get(response, 'metadata.teams', []).indexOf(testTeam._id.toString()) !== -1, 'Should have testTeam as a team.');
          template.formio.user1.token = res.headers['x-jwt-token'];
          done();
        });
      });

      it('A non-accepted Team member with team_read, should be able to read a project role', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/role/' + testRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to update a project role', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/role/' + testRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: chance.word()
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to delete a project role', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/role/' + testRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should be able to read the project data', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(teamProject, 'settings', 'billing', 'modified', 'public', 'apiCalls'), _.omit(response, 'modified', 'public', 'disabled', 'addConfigToForms', 'apiCalls'));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read should be able to access /team/project/:projectId', function(done) {
        request(app)
          .get('/team/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, testTeam._id);

            // Check that the teams role was injected into the response.
            assert.equal(response[0].permission, 'team_read');

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to read the project settings data', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), false);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to update the project settings data', function(done) {
        request(app)
          .put('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            settings: {
              foo: 'bar'
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to delete the project', function(done) {
        request(app)
          .delete('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to add a team to a project they dont own', function(done) {
        var teamAccess = {type: 'team_read', roles: [template.team2._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            oldResponse.access = oldResponse.access.concat(teamAccess);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.user1.token)
              .send(oldResponse)
              .expect('Content-Type', /text/)
              .expect(401)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                // Confirm that the team role was not added to the projects permissions.
                var response = res.text;
                assert.equal(response, 'Unauthorized');

                // Store the JWT for future API calls.
                template.formio.user1.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      // Form tests
      it('A Team member with team_read, should not be able to create a form', function(done) {
        var tempForm = {
          title: 'Temp2 Form',
          name: 'temp2Form',
          path: 'temp2/tempform',
          type: 'form',
          access: [],
          submissionAccess: [],
          components: [
            {
              type: 'textfield',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: false
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'foo',
              key: 'foo',
              label: 'foo',
              inputMask: '',
              inputType: 'text',
              input: true
            }
          ]
        };

        request(app)
          .post('/project/' + teamProject._id + '/form')
          .set('x-jwt-token', template.formio.user1.token)
          .send(tempForm)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should be able to read any form', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/form/' + testForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to update a form', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/form/' + testForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              components: []
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to delete a form', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/form/' + testForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      // Submission tests
      it('A Team member with team_read, should not be able to create a submission', function(done) {
        request(app)
          .post('/project/' + teamProject._id + '/form/' + testForm._id + '/submission')
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              foo: 'bar2'
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should be able to read a submission', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/form/' + testForm._id + '/submission/' + testSubmission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              foo: 'bar2'
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to update a submission', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/form/' + testForm._id + '/submission/' + testSubmission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              foo: 'updated'
            }
          })
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_read, should not be able to delete a submission', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/form/' + testForm._id + '/submission/' + testSubmission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      // Normalization
      it('A Project Owner should be able to remove any team with access to the project', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            var oldAccess = _.clone(oldResponse.access);
            var newAccess = _.filter(oldAccess, function(permission) {
              if (permission.type && !_.startsWith(permission.type, 'team_')) {
                return permission;
              }
            });

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: newAccess })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var response = res.body;
                assert.notEqual(oldAccess.length, newAccess.length);
                assert.equal(oldAccess.length, (newAccess.length + 1));

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });
    });

    describe('Permissions - team_write', function() {
      // Bootstrap
      it('A Project Owner should be able to add one of their teams to have access with the team_write permission', function(done) {
        var teamAccess = {type: 'team_write', roles: [testTeam._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: oldResponse.access.concat(teamAccess) })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var found = false;
                var response = res.body;
                response.access.forEach(function(element) {
                  if (element.type === 'team_write') {
                    found = true;
                    assert.notEqual(testTeam._id, null);
                    assert.notEqual(testTeam._id, '');
                    assert.deepEqual(element, teamAccess);
                  }
                });

                assert.equal(found, true);

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      // Project tests
      var tempRole = null;
      it('A Team member with team_write, should be able to create a project role', function(done) {
        request(app)
          .post('/project/' + teamProject._id + '/role')
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: chance.word(),
            description: chance.sentence()
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempRole = response;

            done();
          });
      });

      it('A Team member with team_write, should be able to read a project role', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/role/' + tempRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_write, should be able to update a project role', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/role/' + tempRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: chance.word()
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.notEqual(response.title, tempRole.title);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempRole = response;

            done();
          });
      });

      it('A Team member with team_write, should not be able to update project access', function(done) {
        var newAccess = {type: 'update_all', roles: [tempRole._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];
            oldResponse.access = oldResponse.access.concat(newAccess);

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.user1.token)
              .send(oldResponse)
              .expect(401)
              .end(done);
          });
      });

      it('A Team member with team_write, should be able to delete a project role', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/role/' + tempRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempRole = null;

            // Update the temp project data.
            var oldSettings = teamProject.settings;
            request(app)
            .get('/project/' + teamProject._id)
            .set('x-jwt-token', template.formio.user1.token)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var _response = res.body;
              teamProject = _response;

              // Add the old project settings back to the template obj.
              if (oldSettings && !_.has(_response, 'settings')) {
                teamProject.settings = oldSettings;
              }

              // Store the JWT for future API calls.
              template.formio.user1.token = res.headers['x-jwt-token'];

              done();
            });
          });
      });

      it('A Team member with team_write, should be able to read the project data', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(teamProject, 'settings', 'modified', 'billing', 'public', 'disabled'), _.omit(response, ['modified', 'billing', 'public', 'disabled']));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_write should be able to access /team/project/:projectId', function(done) {
        request(app)
          .get('/team/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, testTeam._id);

            // Check that the teams role was injected into the response.
            assert.equal(response[0].permission, 'team_write');

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_write, should not be able to read the project settings data', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), false);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      var _project;
      it('A Team member with team_write, should not be able to update the project settings data', function(done) {
        var temp = {
          settings: {
            foo: 'bar'
          }
        };

        request(app)
          .put('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send(temp)
          .expect(401)
          .end(done);
      });

      it('A Team member with team_write, should not be able to update the project data', function(done) {
        request(app)
          .put('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            description: chance.sentence()
          })
          .expect(401)
          .end(done);
      });

      it('A Team member with team_write, should not be able to delete the project', function(done) {
        request(app)
          .delete('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_write, should not be able to add a team to a project they dont own', function(done) {
        var teamAccess = {type: 'team_write', roles: [template.team2._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];
            oldResponse.access = oldResponse.access.concat(teamAccess);

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.user1.token)
              .send(oldResponse)
              .expect(401)
              .end(done);
          });
      });

      // Form tests
      var tempForm = null;
      it('A Team member with team_write, should be able to create a form', function(done) {
        tempForm = {
          title: chance.word(),
          name: chance.word(),
          path: chance.word(),
          type: 'form',
          access: [],
          submissionAccess: [],
          components: [
            {
              type: 'textfield',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: false
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'foo',
              key: 'foo',
              label: 'foo',
              inputMask: '',
              inputType: 'text',
              input: true
            }
          ]
        };

        request(app)
          .post('/project/' + teamProject._id + '/form')
          .set('x-jwt-token', template.formio.user1.token)
          .send(tempForm)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = response;

            done();
          });
      });

      it('A Team member with team_write, should be able to read a form', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/form/' + tempForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(response, ignoreFields), _.omit(tempForm, ignoreFields));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = response;

            done();
          });
      });

      it('A Team member with team_write, should be able to update a form', function(done) {
        tempForm.title = chance.word();

        request(app)
          .put('/project/' + teamProject._id + '/form/' + tempForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: tempForm.title
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(response, [...ignoreFields, 'modified']), _.omit(tempForm,[...ignoreFields, 'modified']));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = response;

            done();
          });
      });

      // Submission tests
      let submission;
      it('A Team member with team_write, should be able to create a submission', function(done) {
        request(app)
          .post('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission')
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              foo: chance.word()
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            submission = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_write, should be able to read a submission', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission/' + submission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_write, should be able to update a submission', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission/' + submission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              foo: chance.sentence()
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_write, should be able to delete a submission', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission/' + submission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      // Final Form test
      it('A Team member with team_write, should be able to delete a form', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/form/' + tempForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: tempForm.title
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(response, [...ignoreFields, 'modified']), _.omit(tempForm, [...ignoreFields, 'modified']));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = response;

            done();
          });
      });

      // Normalization
      it('A Project Owner should be able to remove any team with access to the project', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            var oldAccess = _.clone(oldResponse.access);
            var newAccess = _.filter(oldAccess, function(permission) {
              if (permission.type && !_.startsWith(permission.type, 'team_')) {
                return permission;
              }
            });

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: newAccess })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var response = res.body;
                assert.notEqual(oldAccess.length, newAccess.length);
                assert.equal(oldAccess.length, (newAccess.length + 1));

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });
    });

    describe('Permissions - team_admin', function() {
      // Bootstrap
      it('A Project Owner should be able to add one of their teams to have access with the team_admin permission', function(done) {
        var teamAccess = {type: 'team_admin', roles: [testTeam._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: oldResponse.access.concat(teamAccess) })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var found = false;
                var response = res.body;
                response.access.forEach(function(element) {
                  if (element.type === 'team_admin') {
                    found = true;
                    assert.notEqual(testTeam._id, null);
                    assert.notEqual(testTeam._id, '');
                    assert.deepEqual(element, teamAccess);
                  }
                });

                assert.equal(found, true);

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      // Project tests
      var tempRole = null;
      it('A Team member with team_admin, should be able to create a project role', function(done) {
        request(app)
          .post('/project/' + teamProject._id + '/role')
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: chance.word(),
            description: chance.sentence()
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempRole = response;

            done();
          });
      });

      it('A Team member with team_admin, should be able to read a project role', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/role/' + tempRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_admin, should be able to update a project role', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/role/' + tempRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: chance.word()
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.notEqual(response.title, tempRole.title);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempRole = response;

            done();
          });
      });

      it('A Team member with team_admin, should be able to update project access', function(done) {
        var newAccess = {type: 'update_all', roles: [tempRole._id]};

        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];
            oldResponse.access = oldResponse.access.concat(newAccess);

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.user1.token)
              .send(oldResponse)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                // Confirm that the team role was not added to the projects permissions.
                var response = res.body;
                var oldPermissions = _.find(oldResponse.access, function(item) {
                  if (item.type === 'update_all') {
                    return item;
                  }
                });
                var newPermissions = _.find(response.access, function(item) {
                  if (item.type === 'update_all') {
                    return item;
                  }
                });

                assert.notDeepEqual(oldPermissions.roles, newPermissions.roles);
                assert.notEqual(newPermissions.roles.indexOf(tempRole._id), -1);

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.user1.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      it('A Team member with team_admin, should be able to delete a project role', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/role/' + tempRole._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempRole = null;

            // Update the temp project data.
            var oldSettings = teamProject.settings;
            request(app)
            .get('/project/' + teamProject._id)
            .set('x-jwt-token', template.formio.user1.token)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var _response = res.body;
              teamProject = _response;

              // Add the old project settings back to the template obj.
              if (oldSettings && !_.has(_response, 'settings')) {
                teamProject.settings = oldSettings;
              }

              // Store the JWT for future API calls.
              template.formio.user1.token = res.headers['x-jwt-token'];

              done();
            });
          });
      });

      it('A Team member with team_admin, should be able to read the project data', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(teamProject, 'modified', 'billing', 'disabled'), _.omit(response, ['modified', 'billing', 'disabled']));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_admin should be able to access /team/project/:projectId', function(done) {
        request(app)
          .get('/team/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.length, 1);
            assert.equal(response[0]._id, testTeam._id);

            // Check that the teams role was injected into the response.
            assert.equal(response[0].permission, 'team_admin');

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_admin, should be able to read the project settings data', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_admin, should be able to update the project settings data', function(done) {
        var temp = {
          settings: {
            cors: '*',
            foo: chance.sentence()
          }
        };

        request(app)
          .put('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send(temp)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(async function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.deepEqual(_.omit(response.settings, ['licenseKey']), temp.settings);

            if (docker) {
              return done();
            }

            try {
              await cache.loadCache.load(teamProject._id, true);

              // Confirm that the settings were changed.
              assert.deepEqual(_.omit(response.settings, ['licenseKey']), temp.settings);

              // Store the JWT for future API calls.
              template.formio.user1.token = res.headers['x-jwt-token'];

              done();
            } catch (err) {
              return done(err);
            }
          });
      });

      it('A Team member with team_admin, should be able to update the project data', function(done) {
        request(app)
          .put('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            description: chance.sentence()
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the template project.
            teamProject = response;

            done();
          });
      });

      // Form tests
      var tempForm = null;
      it('A Team member with team_admin, should be able to create a form', function(done) {
        tempForm = {
          title: chance.word(),
          name: chance.word(),
          path: chance.word(),
          type: 'form',
          access: [],
          submissionAccess: [],
          components: [
            {
              type: 'textfield',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: false
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'foo',
              key: 'foo',
              label: 'foo',
              inputMask: '',
              inputType: 'text',
              input: true
            }
          ]
        };

        request(app)
          .post('/project/' + teamProject._id + '/form')
          .set('x-jwt-token', template.formio.user1.token)
          .send(tempForm)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = response;

            done();
          });
      });

      it('A Team member with team_admin, should be able to read a form', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/form/' + tempForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(response, ignoreFields), _.omit(tempForm, ignoreFields));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = response;

            done();
          });
      });

      it('A Team member with team_admin, should be able to update a form', function(done) {
        tempForm.title = chance.word();

        request(app)
          .put('/project/' + teamProject._id + '/form/' + tempForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            title: tempForm.title
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.deepEqual(_.omit(response, [...ignoreFields, 'modified']), _.omit(tempForm, [...ignoreFields, 'modified']));

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = response;

            done();
          });
      });

      // Submission tests
      var tempSubmission = null;
      it('A Team member with team_admin, should be able to create a submission', function(done) {
        tempSubmission = {
          data: {
            foo: 'baz'
          }
        };

        request(app)
          .post('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission')
          .set('x-jwt-token', template.formio.user1.token)
          .send(tempSubmission)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp submission.
            tempSubmission = response;

            done();
          });
      });

      it('A Team member with team_admin, should be able to read a submission', function(done) {
        request(app)
          .get('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission/' + tempSubmission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            assert.deepEqual(response, tempSubmission);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team member with team_admin, should be able to update a submission', function(done) {
        request(app)
          .put('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission/' + tempSubmission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .send({
            data: {
              foo: chance.sentence()
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;

            assert.notEqual(response.data.foo, 'baz');
            assert.notEqual(response.modified, tempSubmission.modified);

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempSubmission = response;

            done();
          });
      });

      it('A Team member with team_admin, should be able to delete a submission', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/form/' + tempForm._id + '/submission/' + tempSubmission._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            tempSubmission = null;

            done();
          });
      });

      // Final Form Test
      it('A Team member with team_admin, should be able to delete a form', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/form/' + tempForm._id)
          .set('x-jwt-token', template.formio.user1.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Store the JWT for future API calls.
            template.formio.user1.token = res.headers['x-jwt-token'];

            // Update the temp form.
            tempForm = null;

            done();
          });
      });

      // Normalization
      it('A Project Owner should be able to remove any team with access to the project', function(done) {
        request(app)
          .get('/project/' + teamProject._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            var oldResponse = res.body;
            var oldAccess = _.clone(oldResponse.access);
            var newAccess = _.filter(oldAccess, function(permission) {
              if (permission.type && !_.startsWith(permission.type, 'team_')) {
                return permission;
              }
            });

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            request(app)
              .put('/project/' + teamProject._id)
              .set('x-jwt-token', template.formio.teamAdmin.token)
              .send({ access: newAccess })
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                var response = res.body;
                assert.notEqual(oldAccess.length, newAccess.length);
                assert.equal(oldAccess.length, (newAccess.length + 1));

                // Update the project.
                teamProject = response;

                // Store the JWT for future API calls.
                template.formio.teamAdmin.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });
    });

    describe('Resource normalization', function() {
      it('Delete a test submission', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/form/' + testForm._id + '/submission/' + testSubmission._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            testSubmission = null;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Delete the test form', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/form/' + testForm._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            testForm = null;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Delete the test role', function(done) {
        request(app)
          .delete('/project/' + teamProject._id + '/role/' + testRole._id)
          .set('x-jwt-token', template.formio.teamAdmin.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            testRole = null;

            // Store the JWT for future API calls.
            template.formio.teamAdmin.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });
  });
};
