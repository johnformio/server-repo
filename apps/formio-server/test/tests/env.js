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

    template.env = {
      owner: null,
      project: null,
      users: {},
      teams: {}
    };

    it(`Register project owner`, function(done) {
      let tempPassword = chance.word({ length: 8 });
      request(app)
        .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
        .send({
          data: {
            'name': chance.word({ length: 10 }),
            'email': chance.email(),
            'password': tempPassword
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          template.env.owner = response;
          template.env.owner.data.password = tempPassword;
          template.env.owner.token = res.headers['x-jwt-token'];
          request(app)
            .post('/payment-gateway')
            .set('x-jwt-token', template.env.owner.token)
            .send({
              data: {
                ccNumber: '4012000033330026',
                ccType: 'visa',
                ccExpiryMonth: '12',
                ccExpiryYear: '2030',
                cardholderName: 'FORMIO Test Account',
                securityCode: '123'
              }
            })
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              done();
            });
          });
    });

    const registerUser = (i, team, done) => {
      let tempPassword = chance.word({ length: 8 });
      request(app)
        .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
        .send({
          data: {
            'name': chance.word({ length: 10 }),
            'email': chance.email(),
            'password': tempPassword
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          template.env.users[`user${i}`] = response;
          template.env.users[`user${i}`].data.password = tempPassword;
          template.env.users[`user${i}`].token = res.headers['x-jwt-token'];
          if (!team) {
            return done();
          }

          // Create a team.
          request(app)
          .post('/team')
          .set('x-jwt-token', template.env.owner.token)
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
            template.env.owner.token = res.headers['x-jwt-token'];
            template.env.teams[`team${i}`] = res.body;

            // Create a team member.
            request(app)
              .post('/team/' + template.env.teams[`team${i}`]._id + '/member')
              .set('x-jwt-token', template.env.owner.token)
              .send({
                data: {
                  userId: template.env.users[`user${i}`]._id,
                  email: template.env.users[`user${i}`].data.email,
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
                template.env.owner.token = res.headers['x-jwt-token'];

                // User accepts team.
                if (!template.env.users[`user${i}`].metadata) {
                  template.env.users[`user${i}`].metadata = {teams: []};
                }
                if (!template.env.users[`user${i}`].metadata.teams) {
                  template.env.users[`user${i}`].metadata = {teams: []};
                }
                template.env.users[`user${i}`].metadata.teams.push(template.env.teams[`team${i}`]._id.toString());
                request(app)
                  .put('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.env.users[`user${i}`]._id)
                  .set('x-jwt-token', template.env.users[`user${i}`].token)
                  .send(template.env.users[`user${i}`])
                  .expect(200)
                  .end(function(err, res) {
                    if (err) {
                      return done(err);
                    }
                    template.env.users[`user${i}`].token = res.headers['x-jwt-token'];
                    done();
                  });
              });
          });
        });
    };

    it('Register user1', (done) => registerUser(1, true, done));
    it('Register user2', (done) => registerUser(2, true, done));
    it('Register user3', (done) => registerUser(3, false, done));

    let firstProject = null;
    it('Create a first project', function(done) {
      var newProject = {
        title: chance.word(),
        description: chance.sentence()
      };
      request(app)
        .post('/project')
        .send(newProject)
        .set('x-jwt-token', template.env.owner.token)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          firstProject = res.body;

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Project Owner should be able to add one of their teams to have access with the team_admin permission', function(done) {
      var teamAccess = [{type: 'team_admin', roles: [template.env.teams.team1._id]}, {type: 'team_write', roles: [template.env.teams.team2._id]}];

      request(app)
        .get('/project/' + firstProject._id)
        .set('x-jwt-token', template.env.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Update the users project access with the new team.
          var oldResponse = res.body;

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          request(app)
            .put('/project/' + firstProject._id)
            .set('x-jwt-token', template.env.owner.token)
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
                  assert.notEqual(template.env.teams.team1._id, null);
                  assert.notEqual(template.env.teams.team1._id, '');
                  assert.deepEqual(element.roles, [template.env.teams.team1._id]);
                }
                if (element.type === 'team_write') {
                  found++;
                  assert.notEqual(template.env.teams.team2._id, null);
                  assert.notEqual(template.env.teams.team2._id, '');
                  assert.deepEqual(element.roles, [template.env.teams.team2._id]);
                }
              });

              assert.equal(found, 2);

              // Update the project.
              firstProject = response;

              // Store the JWT for future API calls.
              template.env.owner.token = res.headers['x-jwt-token'];

              done();
            });
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
        .set('x-jwt-token', template.env.owner.token)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          secondProject = res.body;

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Add a form to the main project.', function(done) {
      request(app)
        .post('/project/' + firstProject._id + '/form')
        .set('x-jwt-token', template.env.owner.token)
        .send(tempForm)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          // Update the temp form.
          tempForm = response;

          done();
        });
    });

    it('Set to commercial plan', done => {
      request(app)
        .post('/project/' + firstProject._id + '/upgrade')
        .set('x-jwt-token', template.env.owner.token)
        .send({plan: 'commercial'})
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          done();
        });
    });

    it('A Form.io user can create an environment', function(done) {
      var myProject = {
        title: chance.word(),
        description: chance.sentence(),
        name: chance.word(),
        project: firstProject._id
      };
      request(app)
        .post('/project')
        .set('x-jwt-token', template.env.owner.token)
        .send(myProject)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert.equal(response.project, firstProject._id);
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
          assert.equal(response.access[0].type, 'team_admin');
          assert.notEqual(response.access[0].roles, [], 'The create_all Administrator `role` should not be empty.');
          assert.equal(response.access[1].type, 'team_write');
          assert.notEqual(response.access[1].roles, [], 'The create_all Administrator `role` should not be empty.');
          assert.equal(response.access[2].type, 'create_all');
          assert.notEqual(response.access[2].roles, [], 'The create_all Administrator `role` should not be empty.');
          assert.equal(response.access[3].type, 'read_all');
          assert.notEqual(response.access[3].roles, [], 'The read_all Administrator `role` should not be empty.');
          assert.equal(response.access[4].type, 'update_all');
          assert.notEqual(response.access[4].roles, [], 'The update_all Administrator `role` should not be empty.');
          assert.equal(response.access[5].type, 'delete_all');
          assert.notEqual(response.access[5].roles, [], 'The delete_all Administrator `role` should not be empty.');
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

          template.env.project = response;

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });
/*
    it('New environment should be a copy of live', function(done) {
      request(app)
        .get('/project/' + firstProject._id + '/' + tempForm.name)
        .set('x-jwt-token', template.env.owner.token)
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
      var newEnv = _.cloneDeep(template.env.project);
      newEnv.project = secondProject._id;
      request(app)
        .put('/project/' + template.env.project._id)
        .send(newEnv)
        .set('x-jwt-token', template.env.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.project, template.env.project.project);

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Team member with team_admin, should be able to create a project role', function(done) {
      request(app)
        .post('/project/' + template.env.project._id + '/role')
        .set('x-jwt-token', template.env.users.user1.token)
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
          template.env.users.user1.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Non Team member should not be able to create a project role', function(done) {
      request(app)
        .post('/project/' + template.env.project._id + '/role')
        .set('x-jwt-token', template.env.users.user3.token)
        .send({
          title: chance.word(),
          description: chance.sentence()
        })
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          done();
        });
    });

    it('A Form.io user should be able to delete an environment for a project they own', function(done) {
      request(app)
        .delete('/project/' + template.env.project._id)
        .set('x-jwt-token', template.env.owner.token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.deepEqual(response, {});

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A team member with team_admin can create an environment', function(done) {
    tempProject.project = firstProject._id;
    request(app)
      .post('/project')
      .send(tempProject)
      .set('x-jwt-token', template.env.users.user1.token)
      .expect('Content-Type', /json/)
      .expect(201)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }

        var response = res.body;
        assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
        assert.equal(response.project, firstProject._id);
        assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
        assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
        assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
        assert.equal(response.access[0].type, 'team_admin');
        assert.notEqual(response.access[0].roles, [], 'The create_all Administrator `role` should not be empty.');
        assert.equal(response.access[1].type, 'team_write');
        assert.notEqual(response.access[1].roles, [], 'The create_all Administrator `role` should not be empty.');
        assert.equal(response.access[2].type, 'create_all');
        assert.notEqual(response.access[2].roles, [], 'The create_all Administrator `role` should not be empty.');
        assert.equal(response.access[3].type, 'read_all');
        assert.notEqual(response.access[3].roles, [], 'The read_all Administrator `role` should not be empty.');
        assert.equal(response.access[4].type, 'update_all');
        assert.notEqual(response.access[4].roles, [], 'The update_all Administrator `role` should not be empty.');
        assert.equal(response.access[5].type, 'delete_all');
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

        template.env.project = response;

        // Store the JWT for future API calls.
        template.env.users.user1.token = res.headers['x-jwt-token'];

        done();
      });
  });

    it('A team member with team_write can not create an environment', function(done) {
    tempProject.project = firstProject._id;
    request(app)
      .post('/project')
      .send(tempProject)
      .set('x-jwt-token', template.env.users.user2.token)
      .expect(403)
      .end(done);
  });

    it('A Non Team member cannot create an environment for a project', function(done) {
      var otherEnvironment = {
        title: chance.word(),
        description: chance.sentence(),
        project: firstProject._id
      };
      request(app)
        .post('/project')
        .send(otherEnvironment)
        .set('x-jwt-token', template.env.users.user3.token)
        .expect(403)
        .end(done);
    });

    it('Anonymous cannot create an environment for a project', function(done) {
      var otherEnvironment = {
        title: chance.word(),
        description: chance.sentence(),
        project: firstProject._id
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
        .set('x-jwt-token', template.env.owner.token)
        .expect(400)
        .end(done);
    });

    it('A Form.io user should be able to create an environment role for a project they own created by a team member', function(done) {
      request(app)
        .post('/project/' + template.env.project._id + '/role')
        .set('x-jwt-token', template.env.owner.token)
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
          template.env.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Form.io user should be able to delete an environment for a project they own created by a team member.', function(done) {
      request(app)
        .delete('/project/' + template.env.project._id)
        .set('x-jwt-token', template.env.owner.token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.deepEqual(response, {});

          // Store the JWT for future API calls.
          template.env.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    // Normalization
    it('A Project Owner should be able to remove any team with access to the project', function(done) {
      request(app)
        .get('/project/' + firstProject._id)
        .set('x-jwt-token', template.env.owner.token)
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
          template.env.owner.token = res.headers['x-jwt-token'];

          request(app)
            .put('/project/' + firstProject._id)
            .set('x-jwt-token', template.env.owner.token)
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
              firstProject = response;

              // Store the JWT for future API calls.
              template.env.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
    });

  });
};
