/**/'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();
var uuidRegex = /^([a-z]{15})$/;
var docker = process.env.DOCKER;

module.exports = function(app, template, hook) {
  if (docker) {
    // No docker tests.
    return;
  }
  var secondProject;

  var not = function(item, properties) {
    if (!item || !properties) {
      return;
    }
    if (!(properties instanceof Array)) {
      return;
    }

    var list = [].concat(item);
    list.forEach(function(i) {
      for(var a = 0; a < properties.length; a++) {
        assert.equal(i.hasOwnProperty(properties[a].toString()), false);
      }
    });
  };

  describe('Environments', function() {
    let tempProject = {
      title: chance.word(),
      description: chance.sentence()
    };
    let tempForm = {
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
    const originalProject = _.cloneDeep(tempProject);

    // Bootstrap
    it('A Formio User should be able to create a Team without users', function(done) {
      request(app)
        .post('/project/' + template.formio.project._id + '/form/' + template.formio.teamResource._id + '/submission')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          data: {
            name: chance.word(),
            members: [{_id: template.users.user2._id}]
          }
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          // Store the team reference for later.
          template.team3 = res.body;

          done();
        });
    });

    it('A Project Owner should be able to add one of their teams to have access with the team_admin permission', function(done) {
      var teamAccess = [{type: 'team_admin', roles: [template.team1._id]}, {type: 'team_write', roles: [template.team3._id]}];

      request(app)
        .get('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
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
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var found = 0;
              var response = res.body;
              response.access.forEach(function(element) {
                if (element.type === 'team_admin') {
                  found++;
                  assert.notEqual(template.team1._id, null);
                  assert.notEqual(template.team1._id, '');
                  assert.deepEqual(element.roles, [template.team1._id]);
                }
                if (element.type === 'team_write') {
                  found++;
                  assert.notEqual(template.team3._id, null);
                  assert.notEqual(template.team3._id, '');
                  assert.deepEqual(element.roles, [template.team3._id]);
                }
              });

              assert.equal(found, 2);

              // Update the project.
              template.project = response;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
    });

    it('Register another Formio User not on a team', function(done) {
      request(app)
        .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
        .send({
          data: {
            'name': chance.name(),
            'email': chance.email(),
            'password': 'test123'
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;

          // Update our testProject.owners data.
          var tempPassword = 'test123';
          template.formio.user2 = response;
          template.formio.user2.data.password = tempPassword;

          // Store the JWT for future API calls.
          template.formio.user2.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Create a second project', function(done) {
      var newProject = {
        title: chance.word(),
        description: chance.sentence()
      };
      request(app)
        .post('/project')
        .send(newProject)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          secondProject = res.body;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Add a form to the main project.', function(done) {
      request(app)
        .post('/project/' + template.project._id + '/form')
        .set('x-jwt-token', template.formio.owner.token)
        .send(tempForm)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          // Update the temp form.
          tempForm = response;

          done();
        });
    });

    it('Set to commercial plan', done => {
      request(app)
        .post('/project/' + template.project._id + '/upgrade')
        .set('x-jwt-token', template.formio.owner.token)
        .send({plan: 'commercial'})
        .expect(200)
        .end(done);
    });

    it('A Form.io user can create an environment', function(done) {
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
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert.equal(response.project, template.project._id);
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
          assert.equal(response.access[0].type, 'create_all');
          assert.notEqual(response.access[0].roles, [], 'The create_all Administrator `role` should not be empty.');
          assert.equal(response.access[1].type, 'read_all');
          assert.notEqual(response.access[1].roles, [], 'The read_all Administrator `role` should not be empty.');
          assert.equal(response.access[2].type, 'update_all');
          assert.notEqual(response.access[2].roles, [], 'The update_all Administrator `role` should not be empty.');
          assert.equal(response.access[3].type, 'delete_all');
          assert.notEqual(response.access[3].roles, [], 'The delete_all Administrator `role` should not be empty.');
          assert.notEqual(response.defaultAccess, [], 'The Projects default `role` should not be empty.');
          assert.equal(response.hasOwnProperty('name'), true);
          assert.equal(response.description, myProject.description);
          assert.equal(response.name, myProject.name);

          // Check plan and api calls info
          if (app.formio) {
            var plan = process.env.PROJECT_PLAN;
            assert.equal(response.plan, plan, 'The plan should match the default new project plan.');
          }

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted', 'primary']);

          template.env = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });
/*
    it('New environment should be a copy of live', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/' + tempForm.name)
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          done();
        });
    });
*/
    it('A Form.io user cannot change an environments primary project', function(done) {
      var newEnv = _.cloneDeep(template.env);
      newEnv.project = secondProject._id;
      request(app)
        .put('/project/' + template.env._id)
        .send(newEnv)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.project, template.env.project);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Team member with team_admin, should be able to create a project role', function(done) {
      request(app)
        .post('/project/' + template.env._id + '/role')
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

          // Store the JWT for future API calls.
          template.formio.user1.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Non Team member should not be able to create a project role', function(done) {
      request(app)
        .post('/project/' + template.env._id + '/role')
        .set('x-jwt-token', template.formio.user2.token)
        .send({
          title: chance.word(),
          description: chance.sentence()
        })
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Store the JWT for future API calls.
          template.formio.user2.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Form.io user should be able to delete an environment for a project they own', function(done) {
      request(app)
        .delete('/project/' + template.env._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.deepEqual(response, {});

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A team member with team_admin can create an environment', function(done) {
    tempProject.project = template.project._id;
    request(app)
      .post('/project')
      .send(tempProject)
      .set('x-jwt-token', template.formio.user1.token)
      .expect('Content-Type', /json/)
      .expect(201)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }

        var response = res.body;
        assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
        assert.equal(response.project, template.project._id);
        assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
        assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
        assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
        assert.equal(response.access[0].type, 'create_all');
        assert.notEqual(response.access[0].roles, [], 'The create_all Administrator `role` should not be empty.');
        assert.equal(response.access[1].type, 'read_all');
        assert.notEqual(response.access[1].roles, [], 'The read_all Administrator `role` should not be empty.');
        assert.equal(response.access[2].type, 'update_all');
        assert.notEqual(response.access[2].roles, [], 'The update_all Administrator `role` should not be empty.');
        assert.equal(response.access[3].type, 'delete_all');
        assert.notEqual(response.access[3].roles, [], 'The delete_all Administrator `role` should not be empty.');
        assert.notEqual(response.defaultAccess, [], 'The Projects default `role` should not be empty.');
        assert.equal(response.hasOwnProperty('name'), true);
        assert.notEqual(response.name.search(uuidRegex), -1);
        assert.equal(response.description, tempProject.description);

        // Check plan and api calls info
        if (app.formio) {
          var plan = process.env.PROJECT_PLAN;
          assert.equal(response.plan, plan, 'The plan should match the default new project plan.');
        }

        // Check that the response does not contain these properties.
        not(response, ['__v', 'deleted', 'settings_encrypted', 'primary']);

        template.env = response;

        // Store the JWT for future API calls.
        template.formio.user1.token = res.headers['x-jwt-token'];

        done();
      });
  });

    it('A team member with team_write can not create an environment', function(done) {
    tempProject.project = template.project._id;
    request(app)
      .post('/project')
      .send(tempProject)
      .set('x-jwt-token', template.formio.user2.token)
      .expect(403)
      .end(done);
  });

    it('A Non Team member cannot create an environment for a project', function(done) {
      var otherEnvironment = {
        title: chance.word(),
        description: chance.sentence(),
        project: template.project._id
      };
      request(app)
        .post('/project')
        .send(otherEnvironment)
        .set('x-jwt-token', template.formio.user2.token)
        .expect(403)
        .end(done);
    });

    it('Anonymous cannot create an environment for a project', function(done) {
      var otherEnvironment = {
        title: chance.word(),
        description: chance.sentence(),
        project: template.project._id
      };
      request(app)
        .post('/project')
        .send(otherEnvironment)
        .expect(401)
        .end(done);
    });

    it('A Form.io user cannot create an environment for a bad project', function(done) {
      var myProject = {
        title: chance.word(),
        description: chance.sentence(),
        name: chance.word(),
        project: '123l4kj23090k23k2'
      };
      request(app)
        .post('/project')
        .send(myProject)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(400)
        .end(done);
    });

    it('A Form.io user should be able to create an environment role for a project they own created by a team member', function(done) {
      request(app)
        .post('/project/' + template.env._id + '/role')
        .set('x-jwt-token', template.formio.owner.token)
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

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Form.io user should be able to delete an environment for a project they own created by a team member.', function(done) {
      request(app)
        .delete('/project/' + template.env._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.deepEqual(response, {});

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    // Normalization
    it('A Project Owner should be able to remove any team with access to the project', function(done) {
      request(app)
        .get('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

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
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.notEqual(oldAccess.length, newAccess.length);
              assert.equal(oldAccess.length, (newAccess.length + 2));

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
