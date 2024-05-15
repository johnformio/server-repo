/**/'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();
var sinon = require('sinon');
var docker = process.env.DOCKER;
const config = require('../../config');

module.exports = function(app, template, hook) {
  if (docker) {
    // No docker tests.
    return;
  }

  describe('Tagging', () => {
    const _template = _.cloneDeep(require('./fixtures/template')());
    let project = {};

    describe('Setup', () => {
      it('Create a project', done => {
        const primaryProject = {
          title: chance.word(),
          description: chance.sentence(),
          name: chance.word(),
          template: _template,
          type: 'project'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.env.owner.token)
          .send(primaryProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            project = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      if (config.formio.hosted) {
        it('Set to team plan', done => {
          request(app)
            .post(`/project/${  project._id  }/upgrade`)
            .set('x-jwt-token', template.env.owner.token)
            .send({plan: 'commercial'})
            .expect(200)
            .end(done);
        });
      }

      it('A Project Owner should be able to add one of their teams to have access with the team_admin permission', done => {
        const teamAccess = {type: 'team_admin', roles: [template.env.teams.team1._id]};

        request(app)
          .get(`/project/${  project._id}`)
          .set('x-jwt-token', template.env.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            // Update the users project access with the new team.
            const oldResponse = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            request(app)
              .put(`/project/${  project._id}`)
              .set('x-jwt-token', template.env.owner.token)
              .send({access: oldResponse.access.concat(teamAccess)})
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                let found = false;
                const response = res.body;
                response.access.forEach(element => {
                  if (element.type === 'team_admin') {
                    found = true;
                    assert.notEqual(template.env.teams.team1._id, null);
                    assert.notEqual(template.env.teams.team1._id, '');
                    assert.deepEqual(element, teamAccess);
                  }
                });

                assert.equal(found, true);

                // Update the project.
                project = response;

                // Store the JWT for future API calls.
                template.env.owner.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });

      it('A Form.io user can create an environment', done => {
        const myProject = {
          title: chance.word(),
          description: chance.sentence(),
          name: chance.word(),
          project: project._id
        };
        request(app)
          .post('/project')
          .set('x-jwt-token', template.env.owner.token)
          .send(myProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            template.env.project = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('User Access', () => {
      let tag, tag2 = {};

      it('A Project Owner should be able to tag an environment', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .send({tag: '0.0.1'})
          .set('x-jwt-token', template.env.owner.token)
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            tag = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Cannot use duplicate tag names', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .send({tag: '0.0.1'})
          .set('x-jwt-token', template.env.owner.token)
          .expect('Content-Type', /json/)
          .expect(400)
          .end(done);
      });

      it('A Team Member with team_admin should be able to tag an environment', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .send({tag: '0.0.2'})
          .set('x-jwt-token', template.env.users.user1.token)
          .expect(201)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            tag2 = res.body;

            assert.equal(tag.owner, template.env.owner._id, 'Project owner should own the tag.');

            // Store the JWT for future API calls.
            template.env.users.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Non Team member should not be able to tag an environment', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .send({tag: '0.0.3'})
          .set('x-jwt-token', template.env.users.user2.token)
          .expect(401)
          .end(done);
      });

      it('Anonymous should not be able to tag an environment', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .send({tag: '0.0.4'})
          .expect(401)
          .end(done);
      });

      it('A Project Owner should not be able to update a tag', done => {
        request(app)
          .put(`/project/${  project._id  }/tag/${  tag._id}`)
          .send(tag)
          .set('x-jwt-token', template.env.owner.token)
          .expect(400)
          .end(done);
      });

      it('A Team Member with team_admin should not be able to update a tag', done => {
        request(app)
          .put(`/project/${  project._id  }/tag/${  tag2._id}`)
          .send(tag2)
          .set('x-jwt-token', template.env.users.user1.token)
          .expect(400)
          .end(done);
      });

      it('A Non Team member should not be able to update a tag', done => {
        request(app)
          .put(`/project/${  project._id  }/tag/${  tag._id}`)
          .send(tag)
          .set('x-jwt-token', template.env.users.user2.token)
          .expect(401)
          .end(done);
      });

      it('Anonymous should not be able to update a tag', done => {
        request(app)
          .put(`/project/${  project._id  }/tag/${  tag._id}`)
          .send(tag)
          .expect(401)
          .end(done);
      });

      it('A Project Owner should be able to read a tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/${  tag._id}`)
          .send()
          .set('x-jwt-token', template.env.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.deepEqual(tag, res.body);

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team Member with team_admin should be able to read a tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/${  tag._id}`)
          .send()
          .set('x-jwt-token', template.env.users.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.deepEqual(tag, res.body);

            // Store the JWT for future API calls.
            template.env.users.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Non Team Member should not be able to read a tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/${  tag._id}`)
          .send()
          .set('x-jwt-token', template.env.users.user2.token)
          .expect(401)
          .end(done);
      });

      it('Anonymous should not be able to read a tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/${  tag._id}`)
          .send()
          .expect(401)
          .end(done);
      });

      it('A Project Owner should be able to read the tag index', done => {
        request(app)
          .get(`/project/${  project._id  }/tag`)
          .send()
          .set('x-jwt-token', template.env.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(2, res.body.length);

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Team Member with team_admin should be able to read the tag index', done => {
        request(app)
          .get(`/project/${  project._id  }/tag`)
          .send()
          .set('x-jwt-token', template.env.users.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(2, res.body.length);

            // Store the JWT for future API calls.
            template.env.users.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Non Team Member should not be able to read the tag index', done => {
        request(app)
          .get(`/project/${  project._id  }/tag`)
          .send()
          .set('x-jwt-token', template.env.users.user2.token)
          .expect(401)
          .end(done);
      });

      it('Anonymous should not be able to read the tag index', done => {
        request(app)
          .get(`/project/${  project._id  }/tag`)
          .send()
          .expect(401)
          .end(done);
      });

      it('A Project owner should be able to access the current tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/current`)
          .set('x-jwt-token', template.env.owner.token)
          .send()
          .expect(200)
          .end((err, res) => {
            if (err) {
              done(err);
            }

            assert.deepEqual(res.body, {tag: '0.0.2'});

            done();
          });
      });

      it('A Team Member with team_admin should be able to access the current tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/current`)
          .set('x-jwt-token', template.env.users.user1.token)
          .send()
          .expect(200)
          .end((err, res) => {
            if (err) {
              done(err);
            }

            assert.deepEqual(res.body, {tag: '0.0.2'});

            done();
          });
      });

      it('A Non Team Member should be able to access the current tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/current`)
          .set('x-jwt-token', template.env.users.user2.token)
          .send()
          .expect(200)
          .end((err, res) => {
            if (err) {
              done(err);
            }

            assert.deepEqual(res.body, {tag: '0.0.2'});

            done();
          });
      });

      it('Anonymous should be able to access the current tag', done => {
        request(app)
          .get(`/project/${  project._id  }/tag/current`)
          .send()
          .expect(200)
          .end((err, res) => {
            if (err) {
              done(err);
            }

            assert.deepEqual(res.body, {tag: '0.0.2'});

            done();
          });
      });

      it('A Project owner should be able to deploy the tag', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
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
              .get(`/project/${  project._id  }/tag/current`)
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
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            type: 'tag',
            tag: '0.0.3'
          })
          .expect(400)
          .end(done);
      });

      it('A Team Member with team_admin should be able to deploy the tag', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.users.user1.token)
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
              .get(`/project/${  project._id  }/tag/current`)
              .send()
              .end((err, res) => {
                assert.equal(res.body.tag, '0.0.2');

                done();
              });
          });
      });

      it('A Non Team Member should not be able to deploy the tag', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.users.user2.token)
          .send({
            type: 'tag',
            tag: '0.0.0'
          })
          .expect(401)
          .end(done);
      });

      it('Anonymous should not be able to deploy the tag', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .send({
            type: 'tag',
            tag: '0.0.0'
          })
          .expect(401)
          .end(done);
      });

      it('A Non Team member should not be able to delete a tag', done => {
        request(app)
          .delete(`/project/${  project._id  }/tag/${  tag2._id}`)
          .send()
          .set('x-jwt-token', template.env.users.user2.token)
          .expect(401)
          .end(done);
      });

      it('Anonymous should not be able to delete a tag', done => {
        request(app)
          .delete(`/project/${  project._id  }/tag/${  tag2._id}`)
          .send()
          .set('x-jwt-token', template.env.users.user2.token)
          .expect(401)
          .end(done);
      });

      it('A Project owner should be able to delete a tag', done => {
        request(app)
          .delete(`/project/${  project._id  }/tag/${  tag2._id}`)
          .send()
          .set('x-jwt-token', template.env.owner.token)
          .expect(200)
          .end(done);
      });

      it('A Team member with team_admin should be able to delete a tag', done => {
        request(app)
          .delete(`/project/${  project._id  }/tag/${  tag._id}`)
          .send()
          .set('x-jwt-token', template.env.users.user1.token)
          .expect(200)
          .end(done);
      });

      it('Recreate the tag', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .send({tag: '0.0.1'})
          .set('x-jwt-token', template.env.owner.token)
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            tag = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('Plan Access', () => {
      if (!config.formio.hosted) {
        return;
      }
      it('Set to basic plan', done => {
        request(app)
          .post(`/project/${  project._id  }/upgrade`)
          .set('x-jwt-token', template.env.owner.token)
          .send({plan: 'basic'})
          .expect(200)
          .end(done);
      });

      it('Should not allow deploying for a basic plans', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            type: 'tag',
            tag: '0.0.1'
          })
          .expect(402)
          .end(done);
      });

      it('Should not allow tagging for a basic plans', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            tag: '0.0.3'
          })
          .expect(402)
          .end(done);
      });

      it('Set to independent plan', done => {
        request(app)
          .post(`/project/${  project._id  }/upgrade`)
          .set('x-jwt-token', template.env.owner.token)
          .send({plan: 'independent'})
          .expect(200)
          .end(done);
      });

      it('Should not allow deploying for a independent plans', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            type: 'tag',
            tag: '0.0.1'
          })
          .expect(402)
          .end(done);
      });

      it('Should not allow tagging for a independent plans', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            tag: '0.0.3'
          })
          .expect(402)
          .end(done);
      });

      it('Set to team plan', done => {
        request(app)
          .post(`/project/${  project._id  }/upgrade`)
          .set('x-jwt-token', template.env.owner.token)
          .send({plan: 'team'})
          .expect(200)
          .end(done);
      });

      it('Should not allow deploying for a team plans', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            type: 'tag',
            tag: '0.0.1'
          })
          .expect(402)
          .end(done);
      });

      it('Should not allow tagging for a team plans', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            tag: '0.0.3'
          })
          .expect(402)
          .end(done);
      });

      it('Set to commercial plan', done => {
        request(app)
          .post(`/project/${  project._id  }/upgrade`)
          .set('x-jwt-token', template.env.owner.token)
          .send({plan: 'commercial'})
          .expect(200)
          .end(done);
      });

      it('Should allow deploying for a commercial plans', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            type: 'tag',
            tag: '0.0.1'
          })
          .expect(200)
          .end(done);
      });

      it('Should allow tagging for a commercial plans', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            tag: '0.0.3'
          })
          .expect(201)
          .end(done);
      });

      it('Set to trial plan', done => {
        request(app)
          .post(`/project/${  project._id  }/upgrade`)
          .set('x-jwt-token', template.env.owner.token)
          .send({plan: 'trial'})
          .expect(200)
          .end(done);
      });

      it('Should allow deploying for a trial plans', done => {
        request(app)
          .post(`/project/${  project._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            type: 'tag',
            tag: '0.0.1'
          })
          .expect(200)
          .end(done);
      });

      it('Should allow tagging for a trial plans', done => {
        request(app)
          .post(`/project/${  project._id  }/tag`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            tag: '0.1.0'
          })
          .expect(201)
          .end(done);
      });
    });

    describe('Deployments', () => {
      let env1, env2, form, formWithEnabledRevisions, formRevisions, parentForm, resource, resourceWithEnabledRevisions, resourceRevisions, parentRecourse, action, role, tag, _export;

      before(done => {
        if (!config.formio.hosted) {
          process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
        }
        done();
      });

      after(done => {
        if (!config.formio.hosted) {
          process.env.TEST_SIMULATE_SAC_PACKAGE = '0';
        }
        done();
      });

      it('Create Environment 1', done => {
        const myProject = {
          title: chance.word(),
          description: chance.sentence(),
          name: chance.word(),
          project: project._id
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

            env1 = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create Environment 2', done => {
        const myProject = {
          title: chance.word(),
          description: chance.sentence(),
          name: chance.word(),
          project: project._id,
          access: [project.access,
            {
              "type": "stage_read",
              "roles": [
                template.formio.teamResource._id
              ]
            }]
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

            env2 = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a form in Environment 1', done => {
        const tempForm = {
          title: chance.word(),
          name: chance.word(),
          path: chance.word().toLowerCase(),
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
          .post(`/project/${  env1._id  }/form`)
          .set('x-jwt-token', template.env.owner.token)
          .send(tempForm)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            form = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a form with enabled revisions and form that contains a nested component with the selected revision in Environment 1', done => {
        const tempFormWithEnabledRevisions = {
          title: chance.word(),
          name: chance.word(),
          path: chance.word().toLowerCase(),
          type: 'form',
          revisions: 'original',
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
              placeholder: 'foo1',
              key: 'foo1',
              label: 'foo1',
              inputMask: '',
              inputType: 'text',
              input: true
            }
          ]
        };

        request(app)
          .post(`/project/${  env1._id  }/form`)
          .set('x-jwt-token', template.env.owner.token)
          .send(tempFormWithEnabledRevisions)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            formWithEnabledRevisions = res.body;
            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            const revision1 = {
              ...tempFormWithEnabledRevisions,
              components: [
                ...tempFormWithEnabledRevisions.components,
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
                  placeholder: 'foo2',
                  key: 'foo2',
                  label: 'foo2',
                  inputMask: '',
                  inputType: 'text',
                  input: true
                }
              ]
            };
            delete revision1._id;

            request(app)
            .put(`/project/${  env1._id  }/form/${  formWithEnabledRevisions._id}`)
            .set('x-jwt-token', template.env.owner.token)
            .send(revision1)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              // Store the JWT for future API calls.
              template.env.owner.token = res.headers['x-jwt-token'];

              const revision2 = {
                ...res.body,
                components: [
                  ...res.body.components, {
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
                    placeholder: 'foo3',
                    key: 'foo3',
                    label: 'foo3',
                    inputMask: '',
                    inputType: 'text',
                    input: true
                }
              ]
              };
              delete revision2._id;

              request(app)
              .put(`/project/${  env1._id  }/form/${  formWithEnabledRevisions._id}`)
              .set('x-jwt-token', template.env.owner.token)
              .send(revision2)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                // Store the JWT for future API calls.
                template.env.owner.token = res.headers['x-jwt-token'];
               // done();

                request(app)
                .get(`/project/${  env1._id  }/form/${ formWithEnabledRevisions._id  }/v`)
                .set('x-jwt-token', template.env.owner.token)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) {
                    return done(err);
                  }

                  formRevisions = res.body;

                  const tempForm = {
                    title: chance.word(),
                    name: chance.word(),
                    path: chance.word().toLowerCase(),
                    type: 'form',
                    access: [],
                    submissionAccess: [],
                    components: [
                      {
                        "label": "Form",
                        "tableView": true,
                        "form": formWithEnabledRevisions._id,
                        "useOriginalRevision": false,
                        "key": "form",
                        "type": "form",
                        "input": true,
                        "revision": formRevisions[1]._id
                      }
                    ]
                  };

                  request(app)
                  .post(`/project/${  env1._id  }/form`)
                  .set('x-jwt-token', template.env.owner.token)
                  .send(tempForm)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) {
                      return done(err);
                    }

                    parentForm = res.body;

                    // Store the JWT for future API calls.
                    template.env.owner.token = res.headers['x-jwt-token'];
                    done();
                  });
                });
              });
            });
          });
      });
/*
      it('test', done => {
        request(app)
        .get('/project/' + env1._id + '/form/'+ formWithEnabledRevisions._id + '/v')
        .set('x-jwt-token', template.env.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          formRevisions = res.body;

          const tempForm = {
            title: chance.word(),
            name: chance.word(),
            path: chance.word().toLowerCase(),
            type: 'resource',
            access: [],
            submissionAccess: [],
            components: [
              {
                "label": "Form",
                "tableView": true,
                "form": formWithEnabledRevisions._id,
                "useOriginalRevision": false,
                "key": "form",
                "type": "form",
                "input": true,
                "revision": formRevisions[1]._id
              }
            ]
          };

          request(app)
          .post('/project/' + env1._id + '/form')
          .set('x-jwt-token', template.env.owner.token)
          .send(tempForm)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            parentForm = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];
            done();
          });
        });
      });
*/

      it('Create a resource in Environment 1', done => {
        const tempResource = {
          title: chance.word(),
          name: chance.word(),
          path: chance.word().toLowerCase(),
          type: 'resource',
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
          .post(`/project/${  env1._id  }/form`)
          .set('x-jwt-token', template.env.owner.token)
          .send(tempResource)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            resource = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create a resource with enabled revisions and a resource that contains a nested component with the selected revision in Environment 1', done => {
        const tempResourceWithEnabledRevisions = {
          title: chance.word(),
          name: chance.word(),
          path: chance.word().toLowerCase(),
          type: 'resource',
          revisions: 'original',
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
              placeholder: 'foo1',
              key: 'foo1',
              label: 'foo1',
              inputMask: '',
              inputType: 'text',
              input: true
            }
          ]
        };

        request(app)
          .post(`/project/${  env1._id  }/form`)
          .set('x-jwt-token', template.env.owner.token)
          .send(tempResourceWithEnabledRevisions)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            resourceWithEnabledRevisions = res.body;
            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            const revision1 = {
              ...tempResourceWithEnabledRevisions,
              components: [
                ...resourceWithEnabledRevisions.components,
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
                  placeholder: 'foo2',
                  key: 'foo2',
                  label: 'foo2',
                  inputMask: '',
                  inputType: 'text',
                  input: true
                }
              ]
            };
            delete revision1._id;

            request(app)
            .put(`/project/${  env1._id  }/form/${  resourceWithEnabledRevisions._id}`)
            .set('x-jwt-token', template.env.owner.token)
            .send(revision1)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              const revision2 = {
                ...res.body,
                components: [
                  ...res.body.components, {
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
                    placeholder: 'foo3',
                    key: 'foo3',
                    label: 'foo3',
                    inputMask: '',
                    inputType: 'text',
                    input: true
                }
              ]
              };
              delete revision2._id;

              request(app)
              .put(`/project/${  env1._id  }/form/${  resourceWithEnabledRevisions._id}`)
              .set('x-jwt-token', template.env.owner.token)
              .send(revision2)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                request(app)
                .get(`/project/${  env1._id  }/form/${ resourceWithEnabledRevisions._id  }/v`)
                .set('x-jwt-token', template.env.owner.token)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) {
                    return done(err);
                  }

                  resourceRevisions = res.body;

                  const tempForm = {
                    title: chance.word(),
                    name: chance.word(),
                    path: chance.word().toLowerCase(),
                    type: 'resource',
                    access: [],
                    submissionAccess: [],
                    components: [
                      {
                        "label": "Form",
                        "tableView": true,
                        "form": resourceWithEnabledRevisions._id,
                        "useOriginalRevision": false,
                        "key": "form",
                        "type": "form",
                        "input": true,
                        "revision": resourceRevisions[2]._id
                      }
                    ]
                  };

                request(app)
                .post(`/project/${  env1._id  }/form`)
                .set('x-jwt-token', template.env.owner.token)
                .send(tempForm)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) {
                    return done(err);
                  }
                  parentRecourse = res.body;
                  done();
                  });
                });
              });
            });
          });
      });

      it('Create a role in Environment 1', done => {
        var myRole = {
          title: 'TestRole',
          description: 'A test role.'
        };
        request(app)
          .post(`/project/${  env1._id  }/role`)
          .set('x-jwt-token', template.env.owner.token)
          .send(myRole)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            role = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Create an action in Environment 1', done => {
        const myAction = {
          title: 'Login',
          name: 'login',
          handler: ['before'],
          method: ['create'],
          priority: 0,
          settings: {
            resources: [resource._id.toString()],
            username: 'username',
            password: 'password'
          }
        };
        request(app)
          .post(`/project/${  env1._id  }/form/${  form._id  }/action`)
          .set('x-jwt-token', template.env.owner.token)
          .send(myAction)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            action = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Add role to project update_all access in Environment 1', done => {
        env1.access = env1.access.map(access => {
          if (access.type === 'update_all') {
            access.roles.push(role._id);
          }
          return access;
        });
        request(app)
          .put(`/project/${  env1._id}`)
          .set('x-jwt-token', template.env.owner.token)
          .send(env1)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            env1 = res.body;

            // Store the JWT for future API calls.
            template.env.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Tag Environment 1', done => {
        request(app)
          .post(`/project/${  env1._id  }/tag`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            tag: '0.0.4'
          })
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            tag = res.body;

            request(app)
              .get(`/project/${  env1._id}`)
              .set('x-jwt-token', template.env.owner.token)
              .send()
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                env1 = res.body;

                assert.equal(env1.tag, '0.0.4');

                done();
              });
          });
      });

      it('Tag Contains the form', done => {
        assert(tag.template.forms[form.machineName.split(':')[1]], 'Tag must contain the form');
        assert(tag.template.forms[formWithEnabledRevisions.machineName.split(':')[1]], 'Tag must contain the form');
        assert(tag.template.forms[parentForm.machineName.split(':')[1]], 'Tag must contain the form');

        done();
      });

      it('Tag Contains the resource', done => {
        assert(tag.template.resources[resource.machineName.split(':')[1]], 'Tag must contain the resource');
        assert(tag.template.resources[resourceWithEnabledRevisions.machineName.split(':')[1]], 'Tag must contain the resource');
        assert(tag.template.resources[parentRecourse.machineName.split(':')[1]], 'Tag must contain the resource');

        done();
      });

      it('Tag Contains the revisions', done => {
        assert(tag.template.revisions[`${formRevisions[1].name}:${formRevisions[1]._id}`], 'Tag must contain the form');
        assert(tag.template.revisions[`${resourceRevisions[2].name}:${resourceRevisions[2]._id}`], 'Tag must contain the form');

        done();
      });

      it('Tag Contains the role', done => {
        const roleName = role.machineName.split(':')[1];
        assert(tag.template.roles[roleName], 'Tag must contain the role');

        done();
      });

      it('Tag Contains the action', done => {
        let actionName = action.machineName.split(':');
        actionName.shift();
        actionName = actionName.join(':');
        assert(tag.template.actions[actionName], 'Tag must contain the action');

        done();
      });

      it('Tag should not contain the project access', done => {
        assert.deepEqual(tag.template.access, []);

        done();
      });

      it('Tag should contain the form and resource access', done => {
        assert(tag.template.forms[form.machineName.split(':')[1]].access, 'Tag must contain form access');
        assert(tag.template.forms[formWithEnabledRevisions.machineName.split(':')[1]].access, 'Tag must contain form access');
        assert(tag.template.forms[parentForm.machineName.split(':')[1]].access, 'Tag must contain form access');
        assert(tag.template.resources[resource.machineName.split(':')[1]].access, 'Tag must contain resource access');
        assert(tag.template.resources[resourceWithEnabledRevisions.machineName.split(':')[1]].access, 'Tag must contain resource access');
        assert(tag.template.resources[parentRecourse.machineName.split(':')[1]].access, 'Tag must contain resource access');

        done();
      });

      it('Deploy tag to environment 2', done => {
        request(app)
          .post(`/project/${  env2._id  }/deploy`)
          .set('x-jwt-token', template.env.owner.token)
          .send({
            type: 'tag',
            tag: '0.0.4'
          })
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            request(app)
              .get(`/project/${  env2._id  }/export`)
              .set('x-jwt-token', template.env.owner.token)
              .send()
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                _export = res.body;

                done();
              });
          });
      });

      it('Environment 2 Contains the form', done => {
        assert(_export.forms[form.machineName.split(':')[1]], 'Env 2 must contain the form');
        assert(_export.forms[formWithEnabledRevisions.machineName.split(':')[1]], 'Tag must contain the resource');
        assert(_export.forms[parentForm.machineName.split(':')[1]], 'Tag must contain the resource');

        done();
      });

      it('Environment 2 Contains the resource', done => {
        assert(_export.resources[resource.machineName.split(':')[1]], 'Env 2 must contain the resource');
        assert(_export.resources[resourceWithEnabledRevisions.machineName.split(':')[1]], 'Tag must contain the resource');
        assert(_export.resources[parentRecourse.machineName.split(':')[1]], 'Tag must contain the resource');

        done();
      });

      it('Environment 2 Contains the role', done => {
        const roleName = role.machineName.split(':')[1];
        assert(_export.roles[roleName], 'Env 2 must contain the role');

        done();
      });

      it('Environment 2 Contains the action', done => {
        let actionName = action.machineName.split(':');
        actionName.shift();
        actionName = actionName.join(':');
        assert(_export.actions[actionName], 'Env 2 must contain the action');

        done();
      });

      it('Environment 2 access should not be changed after deployment (including stage teams settings)', done => {
        request(app)
        .get(`/project/${  env2._id  }`)
        .set('x-jwt-token', template.env.owner.token)
        .send()
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.deepEqual(res.body.access, env2.access);

          done();
        });
      });
    });

    describe('Normalization', () => {
      it('A Project Owner should be able to remove any team with access to the project', done => {
        request(app)
          .get(`/project/${  project._id}`)
          .set('x-jwt-token', template.env.owner.token)
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
            template.env.owner.token = res.headers['x-jwt-token'];

            request(app)
              .put(`/project/${  project._id}`)
              .set('x-jwt-token', template.env.owner.token)
              .send({access: newAccess})
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
                project = response;

                // Store the JWT for future API calls.
                template.env.owner.token = res.headers['x-jwt-token'];

                done();
              });
          });
      });
    });
  });
};
