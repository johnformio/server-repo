/**/'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();

module.exports = function(app, template, hook) {
  describe('Tagging', () => {
    let tag, tag2 = {};

    it('A Project Owner should be able to add one of their teams to have access with the team_admin permission', done => {
      var teamAccess = {type: 'team_admin', roles: [template.team1._id]};

      request(app)
        .get('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          // Update the users project access with the new team.
          var oldResponse = res.body;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          request(app)
            .put('/project/' + template.project._id)
            .set('x-jwt-token', template.formio.owner.token)
            .send({ access: oldResponse.access.concat(teamAccess) })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              var found = false;
              var response = res.body;
              response.access.forEach(element => {
                if (element.type === 'team_admin') {
                  found = true;
                  assert.notEqual(template.team1._id, null);
                  assert.notEqual(template.team1._id, '');
                  assert.deepEqual(element, teamAccess);
                }
              });

              assert.equal(found, true);

              // Update the project.
              template.project = response;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
    });

    it('A Form.io user can create an environment', done => {
      var myProject = {
        title: chance.word(),
        description: chance.sentence(),
        name: chance.word(),
        project: template.project._id
      };
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send(myProject)
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          template.env = res.body;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Project Owner should be able to tag an environment', done => {
      request(app)
        .post('/project/' + template.project._id + '/tag')
        .send({ tag: '0.0.1' })
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          tag = res.body;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Cannot use duplicate tag names', done => {
      request(app)
        .post('/project/' + template.project._id + '/tag')
        .send({ tag: '0.0.1' })
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(400)
        .end(done);
    });

    it('A Team Member with team_admin should be able to tag an environment', done => {
      request(app)
        .post('/project/' + template.project._id + '/tag')
        .send({ tag: '0.0.2' })
        .set('x-jwt-token', template.formio.user1.token)
        .expect(201)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          tag2 = res.body;

          assert.equal(tag.owner, template.formio.owner._id, 'Project owner should own the tag.');

          // Store the JWT for future API calls.
          template.formio.user1.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Non Team member should not be able to tag an environment', done => {
      request(app)
        .post('/project/' + template.project._id + '/tag')
        .send({ tag: '0.0.3' })
        .set('x-jwt-token', template.formio.user2.token)
        .expect(401)
        .end(done);
    });

    it('Anonymous should not be able to tag an environment', done => {
      request(app)
        .post('/project/' + template.project._id + '/tag')
        .send({ tag: '0.0.4' })
        .expect(401)
        .end(done);
    });

    it('A Project Owner should not be able to update a tag', done => {
      request(app)
        .put('/project/' + template.project._id + '/tag/' + tag._id)
        .send(tag)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(400)
        .end(done);
    });

    it('A Team Member with team_admin should not be able to update a tag', done => {
      request(app)
        .put('/project/' + template.project._id + '/tag/' + tag2._id)
        .send(tag2)
        .set('x-jwt-token', template.formio.user1.token)
        .expect(400)
        .end(done);
    });

    it('A Non Team member should not be able to update a tag', done => {
      request(app)
        .put('/project/' + template.project._id + '/tag/' + tag._id)
        .send(tag)
        .set('x-jwt-token', template.formio.user2.token)
        .expect(401)
        .end(done);
    });

    it('Anonymous should not be able to update a tag', done => {
      request(app)
        .put('/project/' + template.project._id + '/tag/' + tag._id)
        .send(tag)
        .expect(401)
        .end(done);
    });

    it('A Project Owner should be able to read a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag._id)
        .send()
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.deepEqual(tag, res.body);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Team Member with team_admin should be able to read a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag._id)
        .send()
        .set('x-jwt-token', template.formio.user1.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.deepEqual(tag, res.body);

          // Store the JWT for future API calls.
          template.formio.user1.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Non Team Member should not be able to read a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag._id)
        .send()
        .set('x-jwt-token', template.formio.user2.token)
        .expect(401)
        .end(done);
    });

    it('Anonymous should not be able to read a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag._id)
        .send()
        .expect(401)
        .end(done);
    });

    it('A Project Owner should be able to read the tag index', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag')
        .send()
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(2, res.body.length);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Team Member with team_admin should be able to read the tag index', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag')
        .send()
        .set('x-jwt-token', template.formio.user1.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(2, res.body.length);

          // Store the JWT for future API calls.
          template.formio.user1.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Non Team Member should not be able to read the tag index', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag')
        .send()
        .set('x-jwt-token', template.formio.user2.token)
        .expect(401)
        .end(done);
    });

    it('Anonymous should not be able to read the tag index', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag')
        .send()
        .expect(401)
        .end(done);
    });

    it('A Project owner should be able to access the current tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/current')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          }

          assert.deepEqual(res.body, { tag: '0.0.0'});

          done();
        });
    });

    it('A Team Member with team_admin should be able to access the current tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/current')
        .set('x-jwt-token', template.formio.user1.token)
        .send()
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          }

          assert.deepEqual(res.body, { tag: '0.0.0'});

          done();
        });
    });

    it('A Non Team Member should be able to access the current tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/current')
        .set('x-jwt-token', template.formio.user2.token)
        .send()
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          }

          assert.deepEqual(res.body, { tag: '0.0.0'});

          done();
        });
    });

    it('Anonymous should be able to access the current tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/current')
        .send()
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          }

          assert.deepEqual(res.body, { tag: '0.0.0'});

          done();
        });
    });

    it('A Project owner should be able to deploy the tag', done => {
      request(app)
        .post('/project/' + template.project._id + '/deploy')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          type: 'tag',
          tag: '0.0.1'
        })
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          // Check that the project version was updated.
          request(app)
            .get('/project/' + template.project._id + '/tag/current')
            .send()
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              assert.equal(res.body.tag, '0.0.1');

              done();
            });
        });
    });

    it('Deploying unknown tag throws error', done => {
      request(app)
        .post('/project/' + template.project._id + '/deploy')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          type: 'tag',
          tag: '0.0.3'
        })
        .expect(400)
        .end(done);
    });

    it('A Team Member with team_admin should be able to deploy the tag', done => {
      request(app)
        .post('/project/' + template.project._id + '/deploy')
        .set('x-jwt-token', template.formio.user1.token)
        .send({
          type: 'tag',
          tag: '0.0.2'
        })
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          // Check that the project version was updated.
          request(app)
            .get('/project/' + template.project._id + '/tag/current')
            .send()
            .end((err, res) => {
              assert.equal(res.body.tag, '0.0.2');

              done();
            });
        });
    });

    it('A Non Team Member should not be able to deploy the tag', done => {
      request(app)
        .post('/project/' + template.project._id + '/deploy')
        .set('x-jwt-token', template.formio.user2.token)
        .send({
          type: 'tag',
          tag: '0.0.0'
        })
        .expect(401)
        .end(done);
    });

    it('Anonymous should not be able to deploy the tag', done => {
      request(app)
        .post('/project/' + template.project._id + '/deploy')
        .send({
          type: 'tag',
          tag: '0.0.0'
        })
        .expect(401)
        .end(done);
    });

    it('Should deploy a tag correctly', done => {
      assert(false, 'stop');
      done();
    });

    it('A Non Team member should not be able to delete a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag2._id)
        .send()
        .set('x-jwt-token', template.formio.user2.token)
        .expect(401)
        .end(done);
    });

    it('Anonymous should not be able to delete a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag2._id)
        .send()
        .set('x-jwt-token', template.formio.user2.token)
        .expect(401)
        .end(done);
    });

    it('A Project owner should be able to delete a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag2._id)
        .send()
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end(done);
    });

    it('A Team member with team_admin should be able to delete a tag', done => {
      request(app)
        .get('/project/' + template.project._id + '/tag/' + tag._id)
        .send()
        .set('x-jwt-token', template.formio.user1.token)
        .expect(200)
        .end(done);
    });

    // Normalization
    it('A Project Owner should be able to remove any team with access to the project', done => {
      request(app)
        .get('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
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
          template.formio.owner.token = res.headers['x-jwt-token'];

          request(app)
            .put('/project/' + template.project._id)
            .set('x-jwt-token', template.formio.owner.token)
            .send({ access: newAccess })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.notEqual(oldAccess.length, newAccess.length);
              assert.equal(oldAccess.length, (newAccess.length + 1));

              // Update the project.
              template.project = response;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
    });

  });
};