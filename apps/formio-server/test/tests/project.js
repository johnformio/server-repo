/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const _ = require('lodash');
const Q = require('q');
const async = require('async');
const chance = new (require('chance'))();
const uuidRegex = /^([a-z]{15})$/;
const util = require('formio/src/util/util');
const config = require('../../config');
const docker = process.env.DOCKER;
const customer = process.env.CUSTOMER;


module.exports = function(app, template, hook) {
  let Helper = require('formio/test/helper')(app);
  const cache = require('../../src/cache/cache')(app.formio);

  /**
   * Helper function to confirm the given properties are not present.
   */
  const not = function(item, properties) {
    if (!item || !properties) {
      return;
    }
    if (!(properties instanceof Array)) {
      return;
    }

    const list = [].concat(item);
    list.forEach(function(i) {
      for(let a = 0; a < properties.length; a++) {
        assert.equal(i.hasOwnProperty(properties[a].toString()), false);
      }
    });
  };

  const confirmProjectPlan = function confirmProjectPlan(id, user, plan, next) {
    request(app)
      .get('/project/' + id)
      .set('x-jwt-token', user.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return next(err);
        }
        try {
          const response = res.body;
          assert.equal(response.hasOwnProperty('plan'), true);
          assert.equal(response.plan, plan);

          // Store the JWT for future API calls.
          user.token = res.headers['x-jwt-token'];
        }
        catch (err) {
          return next(err);
        }
        next();
      });
  };

  const deleteProjects = function(projects, next) {
    async.each(projects, function(proj, cb) {
      request(app)
        .delete('/project/' + proj._id)
        .set('x-jwt-token', template.formio.owner.token)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert.deepEqual(response, {});

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          cb();
        });
    }, function(err) {
      return next(err);
    });
  };

  let formId;

  describe('Projects', function() {
    const tempProject = {
      title: chance.word(),
      description: chance.sentence(),
      template: _.pick(template, ['title', 'name', 'version', 'description', 'roles', 'resources', 'forms', 'actions', 'access'])
    };
    const originalProject = _.cloneDeep(tempProject);

    // Update the template with current data for future tests.
    const mapProjectToTemplate = function(template, callback) {
      const mapActions = function(forms, cb) {
        for (let a = 0; a < forms.length || 0; a++) {
          let form = forms[a];
          formId = form._id;

          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/action?limit=9999')
            .set('x-jwt-token', template.formio.owner.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return cb(err);

              // Update the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              res.body.forEach(function(action) {
                template.actions = template.actions || {};
                template.actions[`${form.name}:${action.name}`] = action;
              });
            });
        }

        cb();
      };

      const mapForms = function(cb) {
        request(app)
          .get('/project/' + template.project._id + '/form?limit=9999')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return cb(err);

            // Update the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            res.body.forEach(function(form) {
              template[form.type + 's'] = template[form.type + 's'] || {}
              template[form.type + 's'][form.name] = form;
            });
            mapActions(res.body, cb);
          });
      };

      const mapRoles = function(cb) {
        request(app)
          .get('/project/' + template.project._id + '/role?limit=9999')
          .set('x-jwt-token', template.formio.owner.token)
          // .expect('Content-Type', /json/)
          // .expect(200)
          .end(function(err, res) {
            if (err) return cb(err);

            // Update the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            res.body.forEach(function(role) {
              template.roles = template.roles || {};
              template.roles[role.title.toLowerCase()] = role;
            });
            cb();
          });
      };

      async.series([
        mapForms,
        mapRoles
      ], function(err) {
        if (err) {
          return callback(err);
        }

        callback();
      });
    };

    it('A Form.io User should be able to create a project from a template', function(done) {
      request(app)
        .post('/project')
        .send(tempProject)
        .set('x-jwt-token', template.formio.owner.token)
        // .expect(201)
        // .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
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

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted', 'primary']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          mapProjectToTemplate(template, done);
        });
    });

    it('A Form.io User should be able to Read their Project', function(done) {
      request(app)
        .get('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
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
          assert.equal(response.name, template.project.name);
          assert.equal(response.description, template.project.description);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted', 'primary', 'machineName']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('An anonymous user should be able to read an empty object for the public configurations.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/config.json')
        // .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert.deepEqual(response, {
            _id: template.project._id
          });
          done();
        });
    });

    it('A user without authentication should not be able to update a project.', function(done) {
      const newDescription = 'An updated Project Description.';
      request(app)
        .put('/project/' + template.project._id)
        .send({
          description: newDescription
        })
        .expect(401)
        .end(done);
    });

    it('A user without authentication should not be able to update the owner of a project.', function(done) {
      request(app)
        .put('/project/' + template.project._id)
        .send({
          owner: template.project._id
        })
        .expect(401)
        .end(done);
    });

    //it('A user without authentication should not be able to update the owner of a project via alias', function(done) {
    //  const primary = app.formio && app.formio.formio && app.formio.formio.config && app.formio.formio.config.formioHost
    //    ? app.formio.formio.config.formioHost
    //    : 'http://formio.localhost:3000';
    //  request(primary)
    //    .put('/')
    //    .send({
    //      owner: template.project._id
    //    })
    //    .expect(401)
    //    .end(done);
    //});

    it('A Form.io User should be able to update the settings of their Project', function(done) {
      const newSettings = {
        cors: '*',
        allowConfig: true,
        keys: [
          {
            name: 'Test Key',
            key: '123testing123testing'
          },
          {
            name: 'Bad Key',
            key: '123testing'
          }
        ],
        email: {
          smtp: {
            host: 'example.com',
            auth: {
              user: 'test',
              pass: 'test1234567890'
            }
          }
        }
      };

      request(app)
        .put('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .send({settings: newSettings})
        // .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert.equal(response.hasOwnProperty('settings'), true);
          assert.deepEqual(_.omit(response.settings, ['licenseKey']), newSettings);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Should show the project public configuration', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/config.json')
        // .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.deepEqual(res.body, {
            _id: template.project._id,
            name: template.project.name,
            config: {}
          })
          done();
        });
    });

    it('Should allow you to provide some public configurations for this project', function(done) {
      request(app)
        .put('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .send({config: {
          one: 'one',
          two: 'two',
          three: {
            four: 'four',
            five: 'five'
          }
        }})
        // .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.deepEqual(res.body.config, {
            one: 'one',
            two: 'two',
            three: {
              four: 'four',
              five: 'five'
            }
          })
          done();
        });
    });

    it('Should allow you to get the new project public configurations.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/config.json')
        // .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.deepEqual(res.body, {
            _id: template.project._id,
            name: template.project.name,
            config: {
              one: 'one',
              two: 'two',
              three: {
                four: 'four',
                five: 'five'
              }
            }
          })
          done();
        });
    });

    const newSettings = {
      cors: '*',
      allowConfig: false,
      keys: [
        {
          name: 'Test Key',
          key: '123testing123testing'
        },
        {
          name: 'Bad Key',
          key: '123testing'
        }
      ],
      email: {
        smtp: {
          host: 'example.com',
          auth: {
            user: 'test',
            pass: 'test1234567890'
          }
        }
      }
    };
    it('Should allow you to turn off the public configurations.', function(done) {
      request(app)
        .put('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .send({settings: newSettings})
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert.equal(response.hasOwnProperty('settings'), true);
          assert.deepEqual(_.omit(response.settings, ['licenseKey']), newSettings);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Should allow you to show empty project configurations.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/config.json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.deepEqual(res.body, {
            _id: template.project._id
          })
          done();
        });
    });

    it('Should not be able to access the forms without a token', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form')
        .expect(401)
        .end(done);
    });

    it('Should not be able to access the forms without a valid token', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form')
        .set('x-token', 'badtoken')
        .expect(401)
        .end(done);
    });

    it('Should not allow short tokens.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form')
        .set('x-token', '123testing')
        .expect(401)
        .end(done);
    });

    it('Should be able to access all the forms with a valid token.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form')
        .set('x-token', '123testing123testing')
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Should not able to get a temporary authentication token without a valid token.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/token')
        .set('x-token', 'badtoken')
        .expect(400)
        .expect('No authentication token provided.')
        .end(done);
    });

    it('Should be able to get a temporary authentication token with a valid token.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/token')
        .set('x-token', '123testing123testing')
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Should be able to read project settings with a valid token', (done) => {
      request(app)
      .get('/project/' + template.project._id)
      .set('x-token', '123testing123testing')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        assert.deepEqual(_.omit(res.body.settings, ['licenseKey']), newSettings);
        done();
      });
    });

    it('Should not allow you to report without a token', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .expect(401)
        .end(done);
    });

    it('Should not allow you to report without a token', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-token', 'badtoken')
        .expect(401)
        .end(done);
    });

    it('Should not allow you to report with a short token', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-token', '123testing')
        .expect(401)
        .end(done);
    });

    it('Should allow you to report with a valid token', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-token', '123testing123testing')
        .expect(204)
        .end(done);
    });

    it('Should allow you to get tags with a valid token', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/tag')
        .set('x-token', '123testing123testing')
        .expect(200)
        .end(done);
    });

    it('A Form.io User should be able to Read the Index of their User-Created Projects', function(done) {
      request(app)
        .get('/project?limit=99999999')
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          let found = false;
          let responseProject = {};
          response.forEach(function(project) {
            if (project.name === template.project.name) {
              responseProject = project;
              found = true;
            }
          });
          assert.equal(found, true);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted']);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('An Anonymous User should not be able to Create a Project', function(done) {
      request(app)
        .post('/project')
        .send(tempProject)
        .expect('Content-Type', /text\/plain/)
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;
          assert.equal(response, 'Unauthorized');

          done();
        });
    });

    it('An Anonymous User should not be able to Read a User-Created Project without permission', function(done) {
      request(app)
        .get('/project/' + template.project._id)
        .expect(401)
        .expect('Content-Type', /text\/plain/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;
          assert.equal(response, 'Unauthorized');

          done();
        });
    });

    it('An Anonymous User should not be able to Update a User-Created Project without permission', function(done) {
      const newDescription = 'An updated Project Description #2.';

      request(app)
        .put('/project/' + template.project._id)
        .send({description: newDescription})
        .expect(401)
        .expect('Content-Type', /text\/plain/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;
          assert.equal(response, 'Unauthorized');

          done();
        });
    });

    it('An Anonymous User should not be able to Read the Index of User-Created Projects', function(done) {
      request(app)
        .get('/project')
        .expect(401)
        .expect('Content-Type', /text\/plain/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;
          assert.equal(response, 'Unauthorized');

          done();
        });
    });

    it('An Anonymous User should not be able to Delete a User-Created Project without permission', function(done) {
      request(app)
        .delete('/project/' + template.project._id)
        .expect(401)
        .expect('Content-Type', /text\/plain/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.text;
          assert.equal(response, 'Unauthorized');

          done();
        });
    });

    it('Updating a Project with duplicate permission types will condense the access permissions', function(done) {
      const newAccess = _.clone(template.project.access);
      newAccess.push({
        type: 'read_all',
        roles: [template.project.defaultAccess]
      });

      request(app)
        .put('/project/' + template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .send({access: newAccess})
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');

          // Confirm that all permission types are present.
          assert.equal(response.access.length, 4);
          const permissions = _.map(response.access, 'type');
          assert.deepEqual(permissions, ['create_all', 'read_all', 'update_all', 'delete_all']);

          // Confirm that all roles are not empty.
          response.access.forEach(function(permission) {
            assert.notEqual(permission.roles, [], 'The ' + permission.type + ' role should not be empty.');
          });

          assert.notEqual(response.defaultAccess, [], 'The Projects default `role` should not be empty.');
          assert.equal(response.description, template.project.description);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    describe('Protected Project', function() {
      let project, form, submission, action, role;

      it('Create a content form for protected testing', function(done) {
        const tempForm = {
          title: 'Protect Form',
          name: 'protectForm',
          path: 'temp/protectform',
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
          .post('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempForm)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            form = res.body;
            done();
          });
      });

      it('Get project definition for testing', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            project = res.body;
            done();
          });
      });

      it('A Form.io User should be able to set a project to protected', function(done) {
        project.protect = true;
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(project)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.hasOwnProperty('protect'), true);
            assert(response.protect, 'Project should be protected');

            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Form.io User should be able to Read a protected Project', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');
            assert(response.protect, 'Project should be protected');
            assert.equal(response.access[0].type, 'create_all');
            assert.notEqual(response.access[0].roles, [], 'The create_all Administrator `role` should not be empty.');
            assert.equal(response.access[1].type, 'read_all');
            assert.notEqual(response.access[1].roles, [], 'The read_all Administrator `role` should not be empty.');
            assert.equal(response.access[2].type, 'update_all');
            assert.notEqual(response.access[2].roles, [], 'The update_all Administrator `role` should not be empty.');
            assert.equal(response.access[3].type, 'delete_all');
            assert.notEqual(response.access[3].roles, [], 'The delete_all Administrator `role` should not be empty.');
            assert.notEqual(response.defaultAccess, [], 'The Projects default `role` should not be empty.');
            assert.equal(response.name, template.project.name);
            assert.equal(response.description, template.project.description);

            // Check that the response does not contain these properties.
            not(response, ['__v', 'deleted', 'settings_encrypted', 'primary', 'machineName']);

            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Form.io User should be able to Read forms of a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });

      it('A Form.io User should be able to Read a form definition of a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/' + template.forms.userLogin.path)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });

      it('A Form.io User cannot Create a form in a protected project', function(done) {
        const tempForm = {
          title: 'Temp Form',
          name: 'tempForm',
          path: 'temp/tempform',
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
          .post('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempForm)
          .expect(403)
          .end(done);
      });

      it('A Form.io User cannot Update a form in a protected project', function(done) {
        request(app)
          .put('/project/' + template.project._id + '/' + template.forms.userLogin.path)
          .set('x-jwt-token', template.formio.owner.token)
          .send(template.forms.userLogin)
          .expect(403)
          .end(done);
      });

      it('A Form.io User cannot Delete a form in a protected project', function(done) {
        request(app)
          .delete('/project/' + template.project._id + '/' + template.forms.userLogin.path)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(403)
          .end(done);
      });

      it('A Form.io User should be able to Read the Index of Actions in a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form/' + template.forms.userLogin._id + '/action')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            action = res.body[0];
            done();
          });
      });

      it('A Form.io User should be able to Read an Action in a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form/' + template.forms.userLogin._id + '/action/' + action._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });

      it('A Form.io User cannot Create an Action in a protected project', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/form/' + template.forms.userLogin._id + '/action')
          .set('x-jwt-token', template.formio.owner.token)
          .send(action)
          .expect(403)
          .end(done);
      });

      it('A Form.io User cannot Update an Action in a protected project', function(done) {
        request(app)
          .put('/project/' + template.project._id + '/form/' + template.forms.userLogin._id + '/action/' + action._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(action)
          .expect(403)
          .end(done);
      });

      it('A Form.io User cannot Delete an Action in a protected project', function(done) {
        request(app)
          .delete('/project/' + template.project._id + '/form/' + template.forms.userLogin._id + '/action/' + action._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(action)
          .expect(403)
          .end(done);
      });

      it('A Form.io User should be able to Read the Index of Roles in a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/role?limit=9999')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            role = res.body[0];
            done();
          });
      });

      it('A Form.io User should be able to Read a Role in a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/role/' + role._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });

      it('A Form.io User cannot Create a Role in a protected project', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/role')
          .set('x-jwt-token', template.formio.owner.token)
          .send(role)
          .expect(403)
          .end(done);
      });

      it('A Form.io User cannot Update a Role in a protected project', function(done) {
        request(app)
          .put('/project/' + template.project._id + '/role/' + role._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(role)
          .expect(403)
          .end(done);
      });

      it('A Form.io User cannot Delete a Role in a protected project', function(done) {
        request(app)
          .delete('/project/' + template.project._id + '/role/' + role._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(403)
          .end(done);
      });

      it('A Form.io User should be able to Create a Submission in a protected project', function(done) {
        const tempSubmission = {
          data: {
            foo: 'test'
          }
        };

        request(app)
          .post('/project/' + template.project._id + '/form/' + form._id + '/submission')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempSubmission)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            submission = res.body;

            assert.deepEqual(res.body.data, tempSubmission.data);
            done();
          });
      });

      it('A Form.io User should be able to Read an Index of Submissions in a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form/' + form._id + '/submission')
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200)
          .end(done);
      });

      it('A Form.io User should be able to Read a Submission in a protected project', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200)
          .end(done);
      });

      it('A Form.io User should be able to Update a Submission in a protected project', function(done) {
        request(app)
          .put('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(submission)
          .expect(200)
          .end(done);
      });

      it('A Form.io User should be able to Delete a Submission in a protected project', function(done) {
        request(app)
          .delete('/project/' + template.project._id + '/form/' + form._id + '/submission/' + submission._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200)
          .end(done);
      });

      it('A Form.io User cannot Update the Access of a protected Project', function(done) {
        const tmpProject = _.cloneDeep(project);
        tmpProject.access = [{ type: project.access[0].type, roles: []}, project.access[1]];

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(tmpProject)
          .expect(200)
          .end((err, res) => {
            if (err) {
              done(err);
            }

            assert.deepEqual(res.body.access, project.access);
            done();
          });
      });

      it('A Form.io User cannot Update the Name of a protected Project', function(done) {
        const tmpProject = _.cloneDeep(project);
        tmpProject.name = chance.word();

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(tmpProject)
          .expect(200)
          .end((err, res) => {
            if (err) {
              done(err);
            }

            assert.equal(res.body.name, project.name);
            done();
          });
      });

      it('A Form.io User should be able to Update the Settings of a protected Project', function(done) {
        const newSettings = {
          cors: '*',
          keys: [
            {
              name: 'Test Key',
              key: '123testing123testing1212'
            },
            {
              name: 'Bad Key',
              key: '123testing12332'
            }
          ],
          email: {
            smtp: {
              host: 'example.com',
              auth: {
                user: 'test2323',
                pass: 'test1233232'
              }
            }
          }
        };

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: newSettings})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.deepEqual(_.omit(response.settings, ['licenseKey']), newSettings);

            // Check that the response does not contain these properties.
            not(response, ['__v', 'deleted', 'settings_encrypted']);

            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Form.io User cannot Delete a protected Project', function(done) {
        request(app)
          .delete('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(403)
          .end(done);
      });

      it('A Form.io User should be able to remove protected on a project', function(done) {
        project.protect = false;
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send(project)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.hasOwnProperty('protect'), true);
            assert(!response.protect, 'Project should not be protected');

            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Clean up project form', function(done) {
        request(app)
          .delete('/project/' + template.project._id + '/' + form.path)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200)
          .end(done);
      });
    });

    if (!docker) {
      it('A Form.io User should be able to Delete their Project without explicit permissions', function (done) {
        request(app)
          .delete('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.deepEqual(response, {});

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    }

    if (!docker) {
      it('A Deleted Project should still remain in the Database', function (done) {
        app.formio.formio.resources.project.model.find({project: template.project._id, deleted: {$eq: null}})
          .exec(function (err, results) {
            if (err) {
              return done(err);
            }

            if (results.length === 0) {
              done();
            }
            else {
              done(new Error('Expected zero results, got ' + results.length));
            }
          });
      });
    }

    if (!docker) {
      it('A Deleted Project should not have any active Forms', function(done) {
        app.formio.formio.resources.form.model.find({project: template.project._id, deleted: {$eq: null}})
          .exec(function(err, results) {
            if (err) {
              return done(err);
            }

            if (results.length === 0) {
              done();
            }
            else {
              done(new Error('Expected zero results, got ' + results.length));
            }
          });
      });
    }

    if (!docker) {
      it('A Deleted Project should not have any active Roles', function(done) {
        app.formio.formio.resources.role.model.find({project: template.project._id, deleted: {$eq: null}})
          .exec(function(err, results) {
            if (err) {
              return done(err);
            }

            if (results.length === 0) {
              done();
            }
            else {
              done(new Error('Expected zero results, got ' + results.length));
            }
          });
      });
    }

    it('Recreate the user Project for later tests', function(done) {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send(originalProject)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
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
          assert.equal(response.description, originalProject.description);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted', 'primary', 'machineName']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          mapProjectToTemplate(template, done);
        });
    });
  });

  describe('Project Plans', function() {
    // TODO: It'd be good to segregate the tests into Docker, Hosted, and Deployed silos so we can stop using
    // imperative conditionals that hold no semantic meaning; for now we won't run project plans if we're not
    // testing a hosted environment
    if (docker || !config.formio.hosted) {
      return;
    }

    const tempProjects = [];
    describe('Basic Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'basic'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will have a uuid generated name on creation', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('name'), true);
            assert.notEqual(response.name.search(uuidRegex), -1);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan should not be able to define its name on project creation', function(done) {
        const attempt = chance.word({length: 10});
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          name: attempt,
          plan: 'basic'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('name'), true);
            assert.notEqual(response.name, attempt);
            assert.notEqual(response.name.search(uuidRegex), -1);

            tempProjects.push(res.body);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan should not be able to change the uuid generated name on project update', function(done) {
        const attempt = chance.word({length: 10});

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({name: attempt})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('name'), true);
            assert.equal(response.name, template.project.name);
            assert.notEqual(response.name.search(uuidRegex), -1);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set cors options on creation', function(done) {
        const attempt = '*,www.example.com';
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          settings: {
            cors: attempt
          },
          plan: 'basic'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), false);
            tempProjects.push(res.body);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set cors options on project update', function(done) {
        const attempt = '*,www.example.com';

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: {cors: attempt}})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, '*');

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set oauth settings on creation', function(done) {
        const attempt = {clientId: chance.word(), clientSecret: chance.word()};
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          settings: {
            oauth: {
              github: attempt
            }
          },
          plan: 'basic'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), false);

            tempProjects.push(res.body);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set oauth settings on project update', function(done) {
        const attempt = {clientId: chance.word(), clientSecret: chance.word()};

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              oauth: {
                github: attempt
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('oauth'), false);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set premium email settings on creation', function(done) {
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          settings: {
            email: {
              custom: {url: chance.word(), username: chance.word(), password: chance.word()},
              smtp: {host: chance.word(), auth: {pass: chance.word(), user: chance.word()}},
              gmail: {auth: {user: chance.word(), pass: chance.word()}},
              sendgrid: {auth: {api_key: chance.word(), api_user: chance.word()}},
              mandrill: {auth: {apiKey: chance.word()}},
              mailgun: {auth: {api_key: chance.word(), domain: chance.word()}}
            }
          },
          plan: 'basic'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), false);

            tempProjects.push(res.body);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set premium email settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              email: {
                custom: {url: chance.word(), username: chance.word(), password: chance.word()},
                smtp: {host: chance.word(), auth: {pass: chance.word(), user: chance.word()}},
                gmail: {auth: {user: chance.word(), pass: chance.word()}},
                sendgrid: {auth: {api_key: chance.word(), api_user: chance.word()}},
                mandrill: {auth: {apiKey: chance.word()}},
                mailgun: {auth: {api_key: chance.word(), domain: chance.word()}}
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('email'), true);
            assert.deepEqual(Object.keys(response.settings.email), ['smtp']);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set file storage settings on creation', function(done) {
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          settings: {
            storage: {
              s3: {
                AWSAccessKeyId: chance.word(),
                AWSSecretKey: chance.word(),
                bucket: chance.word(),
                bucketUrl: chance.word(),
                expiration: chance.word(),
                maxSize: chance.word(),
                startsWith: chance.word()
              },
              dropbox: {
                access_token: chance.word()
              }
            }
          },
          plan: 'basic'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), false);

            tempProjects.push(res.body);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set file storage settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              storage: {
                s3: {
                  AWSAccessKeyId: chance.word(),
                  AWSSecretKey: chance.word(),
                  bucket: chance.word(),
                  bucketUrl: chance.word(),
                  expiration: chance.word(),
                  maxSize: chance.word(),
                  startsWith: chance.word()
                },
                dropbox: {
                  access_token: chance.word()
                }
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('storage'), false);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set data connection settings on creation', function(done) {
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          settings: {
            atlassian: {
              url: chance.word()
            },
            databases: {
              mssql: {
                azure: true,
                database: chance.word(),
                host: chance.word(),
                password: chance.word(),
                port: chance.word(),
                user: chance.word()
              },
              mysql: {
                database: chance.word(),
                host: chance.word(),
                password: chance.word(),
                port: chance.word(),
                user: chance.word()
              }
            },
            google: {
              clientId: chance.word(),
              cskey: chance.word(),
              refreshtoken: chance.word()
            },
            hubspot: {
              apikey: chance.word()
            },
            kickbox: {
              apikey: chance.word()
            },
            office365: {
              cert: chance.word(),
              clientId: chance.word(),
              email: chance.word(),
              tenant: chance.word(),
              thumbprint: chance.word()
            },
            sqlconnector: {
              host: chance.word(),
              password: chance.word(),
              type: chance.word(),
              user: chance.word()
            }
          },
          plan: 'basic'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), false);

            tempProjects.push(res.body);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set data connection settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              databases: {
                mssql: {
                  azure: true,
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                },
                mysql: {
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                }
              },
              google: {
                clientId: chance.word(),
                cskey: chance.word(),
                refreshtoken: chance.word()
              },
              kickbox: {
                apikey: chance.word()
              },
              sqlconnector: {
                host: chance.word(),
                password: chance.word(),
                type: chance.word(),
                user: chance.word()
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('databases'), false);
            assert.equal(response.settings.hasOwnProperty('google'), false);
            assert.equal(response.settings.hasOwnProperty('kickbox'), false);
            assert.equal(response.settings.hasOwnProperty('sqlconnector'), false);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to create environments', function(done) {
        const otherProject = {
          title: chance.word(),
          description: chance.sentence(),
          project: template.project._id
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(otherProject)
          .expect(402)
          .end(done);
      });

      it('A Project on the Basic plan will not be able to use the default email provider', function(done){
        request(app)
          .get('/project/' + template.project._id + '/form/' + formId + '/actions')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res){
            if (err) {
             return done(err);
            }
            const emailAction = _.findIndex(res.body, action=> action.name === 'email')
            assert.equal(emailAction, -1);
            done();
          })
      })

      after(function(done) {
        deleteProjects(tempProjects, done);
      });
    });

    describe('CORS Access for default', function() {
      if (!docker)
      before(function(done) {
        // Confirm the dummy project is on the team plan.
        cache.updateProject(template.project._id, {
          plan: 'team',
          settings: {
            portalDomain: 'https://portal.form.io'
          }
        }, (err, project) => {
          if (err) {
            return done(err);
          }

          done();
        });
      });

      if (!docker)
      it ('should respond short circuit for portal domains.', function(done) {
        request(app)
          .options('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'https://portal.form.io')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], 'https://portal.form.io');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });

      if (!docker)
      it ('should respond with cors request to role endpoint.', function(done) {
        request(app)
          .options('/project/' + template.project._id + '/role')
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'https://portal.form.io')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], 'https://portal.form.io');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });

      if (!docker)
      it ('should respond with cors request for form.', function(done) {
        request(app)
          .options('/user/login')
          .set('x-jwt-token', template.formio.owner.token)
          .set('host', 'https://formio.form.io')
          .set('Origin', 'https://portal.form.io')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], 'https://portal.form.io');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });

      if (!docker)
      it ('should respond to cors options request with the proper header when using default cors.', function(done) {
        request(app)
          .options('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'http://www.example.com')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], '*');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });

      if (!docker)
      it ('should respond to regular requests with the proper header when using default cors.', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'http://www.example.com')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], '*');
            assert.equal(res.headers.hasOwnProperty('access-control-allow-methods'), false);
            done();
          });
      });
    });

    describe('CORS Access for project with CORS', function() {
      const cors = 'http://www.example.com,http://portal.example.com';

      if (!docker)
      before(function(done) {
        cache.updateProject(template.project._id, {plan: 'commercial'}, (err, project) => {
          if (err) {
            return done(err);
          }

          done();
        });
      });

      if (!docker)
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: {cors: cors}})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, cors);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      if (!docker)
      it ('should allow access to the project root.', function(done) {
        request(app)
          .options('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'http://www.example.com')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], 'http://www.example.com');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });

      if (!docker)
      it ('should respond to cors options request with the proper header when using default cors.', function(done) {
        request(app)
          .options('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'http://www.example.com')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], 'http://www.example.com');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });

      if (!docker)
      it ('should respond to regular requests with the proper header when using default cors.', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'http://www.example.com')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], '*');
            assert.equal(res.headers.hasOwnProperty('access-control-allow-methods'), false);
            done();
          });
      });

      if (!docker)
      it ('should respond to requests from a disallowed domain with https://form.io.', function(done) {
        request(app)
          .options('/project/' + template.project._id + '/form')
          .set('x-jwt-token', template.formio.owner.token)
          .set('Origin', 'http://bad.example.com')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], 'https://form.io');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });

      if (!docker)
      it ('should not allow CORS requests if using an API key in a querystring.', function(done) {
        request(app)
          .options('/project/' + template.project._id + '/form?token=12345678901234567890')
          .set('Origin', 'http://www.example.com')
          .send()
          .end(function(err, res) {
            assert.equal(res.headers['access-control-allow-origin'], 'https://form.io');
            assert.equal(res.headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
            done();
          });
      });
    });

    describe('Independent Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'independent'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'independent');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will be able to change the project name on project update', function(done) {
        const attempt = chance.word({length: 10});

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({name: attempt})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'independent');
            assert.equal(response.hasOwnProperty('name'), true);
            assert.equal(response.name, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will not be able to set cors options on project update', function(done) {
        const attempt = '*,www.example.com';

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: {cors: attempt}})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'independent');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, '*');

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will be able to set oauth settings on project update', function(done) {
        const attempt = {clientId: chance.word(), clientSecret: chance.word()};

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              oauth: {
                github: attempt
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'independent');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('oauth'), true);
            assert.equal(response.settings.oauth.hasOwnProperty('github'), true);
            assert.deepEqual(response.settings.oauth.github, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will be able to set premium email settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              email: {
                custom: {url: chance.word(), username: chance.word(), password: chance.word()},
                smtp: {host: chance.word(), auth: {pass: chance.word(), user: chance.word()}},
                gmail: {auth: {user: chance.word(), pass: chance.word()}},
                sendgrid: {auth: {api_key: chance.word(), api_user: chance.word()}},
                mandrill: {auth: {apiKey: chance.word()}},
                mailgun: {auth: {api_key: chance.word(), domain: chance.word()}}
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'independent');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('email'), true);
            assert.deepEqual(Object.keys(response.settings.email), ['custom', 'smtp', 'gmail', 'sendgrid', 'mandrill', 'mailgun']);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will not be able to set file storage settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              storage: {
                s3: {
                  AWSAccessKeyId: chance.word(),
                  AWSSecretKey: chance.word(),
                  bucket: chance.word(),
                  bucketUrl: chance.word(),
                  expiration: chance.word(),
                  maxSize: chance.word(),
                  startsWith: chance.word()
                },
                dropbox: {
                  access_token: chance.word()
                }
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'independent');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('storage'), false);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will be able to set data connection settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              atlassian: {
                url: chance.word()
              },
              databases: {
                mssql: {
                  azure: true,
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                },
                mysql: {
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                }
              },
              google: {
                clientId: chance.word(),
                cskey: chance.word(),
                refreshtoken: chance.word()
              },
              hubspot: {
                apikey: chance.word()
              },
              kickbox: {
                apikey: chance.word()
              },
              office365: {
                cert: chance.word(),
                clientId: chance.word(),
                email: chance.word(),
                tenant: chance.word(),
                thumbprint: chance.word()
              },
              sqlconnector: {
                host: chance.word(),
                password: chance.word(),
                type: chance.word(),
                user: chance.word()
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'independent');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('atlassian'), true);
            assert.equal(response.settings.hasOwnProperty('databases'), true);
            assert.equal(response.settings.hasOwnProperty('google'), true);
            assert.equal(response.settings.hasOwnProperty('hubspot'), true);
            assert.equal(response.settings.hasOwnProperty('kickbox'), true);
            assert.equal(response.settings.hasOwnProperty('office365'), true);
            assert.equal(response.settings.hasOwnProperty('sqlconnector'), true);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will not be able to create environments', function(done) {
        const otherProject = {
          title: chance.word(),
          description: chance.sentence(),
          project: template.project._id
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(otherProject)
          .expect(402)
          .end(done);
      });

      it('A Project on the Independent plan will be able to use the default email provider', function(done){
        request(app)
          .get('/project/' + template.project._id + '/form/' + formId + '/actions')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res){
            if (err) {
             return done(err);
            }
            const emailAction = _.findIndex(res.body, action=> action.name === 'email')
            assert.notEqual(emailAction, -1);
            done();
          })
      })
    });

    describe('Team Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'team'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'team');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Team plan will be able to change the project name on project update', function(done) {
        const attempt = chance.word({length: 10});

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({name: attempt})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'team');
            assert.equal(response.hasOwnProperty('name'), true);
            assert.equal(response.name, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Team plan will be able to set cors options on project update', function(done) {
        const attempt = '*,www.example.com';

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: {cors: attempt}})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'team');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Team plan will be able to set oauth settings on project update', function(done) {
        const attempt = {clientId: chance.word(), clientSecret: chance.word()};

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              oauth: {
                github: attempt
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'team');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('oauth'), true);
            assert.equal(response.settings.oauth.hasOwnProperty('github'), true);
            assert.deepEqual(response.settings.oauth.github, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Team plan will be able to set premium email settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              email: {
                custom: {url: chance.word(), username: chance.word(), password: chance.word()},
                smtp: {host: chance.word(), auth: {pass: chance.word(), user: chance.word()}},
                gmail: {auth: {user: chance.word(), pass: chance.word()}},
                sendgrid: {auth: {api_key: chance.word(), api_user: chance.word()}},
                mandrill: {auth: {apiKey: chance.word()}},
                mailgun: {auth: {api_key: chance.word(), domain: chance.word()}}
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'team');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('email'), true);
            assert.deepEqual(Object.keys(response.settings.email), ['custom', 'smtp', 'gmail', 'sendgrid', 'mandrill', 'mailgun']);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Team plan will be able to set file storage settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              storage: {
                s3: {
                  AWSAccessKeyId: chance.word(),
                  AWSSecretKey: chance.word(),
                  bucket: chance.word(),
                  bucketUrl: chance.word(),
                  expiration: chance.word(),
                  maxSize: chance.word(),
                  startsWith: chance.word()
                },
                dropbox: {
                  access_token: chance.word()
                }
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'team');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('storage'), true);
            assert.deepEqual(Object.keys(response.settings.storage), ['s3', 'dropbox']);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Team plan will be able to set data connection settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              atlassian: {
                url: chance.word()
              },
              databases: {
                mssql: {
                  azure: true,
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                },
                mysql: {
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                }
              },
              google: {
                clientId: chance.word(),
                cskey: chance.word(),
                refreshtoken: chance.word()
              },
              hubspot: {
                apikey: chance.word()
              },
              kickbox: {
                apikey: chance.word()
              },
              office365: {
                cert: chance.word(),
                clientId: chance.word(),
                email: chance.word(),
                tenant: chance.word(),
                thumbprint: chance.word()
              },
              sqlconnector: {
                host: chance.word(),
                password: chance.word(),
                type: chance.word(),
                user: chance.word()
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'team');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('atlassian'), true);
            assert.equal(response.settings.hasOwnProperty('databases'), true);
            assert.equal(response.settings.hasOwnProperty('google'), true);
            assert.equal(response.settings.hasOwnProperty('hubspot'), true);
            assert.equal(response.settings.hasOwnProperty('kickbox'), true);
            assert.equal(response.settings.hasOwnProperty('office365'), true);
            assert.equal(response.settings.hasOwnProperty('sqlconnector'), true);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Team plan will not be able to create environments', function(done) {
        const otherProject = {
          title: chance.word(),
          description: chance.sentence(),
          project: template.project._id
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(otherProject)
          .expect(402)
          .end(done);
      });

      it('A Project on the Team plan will be able to use the default email provider', function(done){
        request(app)
          .get('/project/' + template.project._id + '/form/' + formId + '/actions')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res){
            if (err) {
             return done(err);
            }
            const emailAction = _.findIndex(res.body, action=> action.name === 'email')
            assert.notEqual(emailAction, -1);
            done();
          })
      })
    });

    describe('Commercial Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'commercial'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'commercial');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Commercial plan will be able to change the project name on project update', function(done) {
        const attempt = chance.word({length: 10});

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({name: attempt})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'commercial');
            assert.equal(response.hasOwnProperty('name'), true);
            assert.equal(response.name, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Commercial plan will be able to set cors options on project update', function(done) {
        const attempt = '*,www.example.com';

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: {cors: attempt}})
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'commercial');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Commercial plan will be able to set oauth settings on project update', function(done) {
        const attempt = {clientId: chance.word(), clientSecret: chance.word()};

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              oauth: {
                github: attempt
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'commercial');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('oauth'), true);
            assert.equal(response.settings.oauth.hasOwnProperty('github'), true);
            assert.deepEqual(response.settings.oauth.github, attempt);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Commercial plan will be able to set premium email settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              email: {
                custom: {url: chance.word(), username: chance.word(), password: chance.word()},
                smtp: {host: chance.word(), auth: {pass: chance.word(), user: chance.word()}},
                gmail: {auth: {user: chance.word(), pass: chance.word()}},
                sendgrid: {auth: {api_key: chance.word(), api_user: chance.word()}},
                mandrill: {auth: {apiKey: chance.word()}},
                mailgun: {auth: {api_key: chance.word(), domain: chance.word()}}
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'commercial');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('email'), true);
            assert.deepEqual(Object.keys(response.settings.email), ['custom', 'smtp', 'gmail', 'sendgrid', 'mandrill', 'mailgun']);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Commercial plan will be able to set file storage settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              storage: {
                s3: {
                  AWSAccessKeyId: chance.word(),
                  AWSSecretKey: chance.word(),
                  bucket: chance.word(),
                  bucketUrl: chance.word(),
                  expiration: chance.word(),
                  maxSize: chance.word(),
                  startsWith: chance.word()
                },
                dropbox: {
                  access_token: chance.word()
                }
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'commercial');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('storage'), true);
            assert.deepEqual(Object.keys(response.settings.storage), ['s3', 'dropbox']);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Commercial plan will be able to set data connection settings on project update', function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            settings: {
              atlassian: {
                url: chance.word()
              },
              databases: {
                mssql: {
                  azure: true,
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                },
                mysql: {
                  database: chance.word(),
                  host: chance.word(),
                  password: chance.word(),
                  port: chance.word(),
                  user: chance.word()
                }
              },
              google: {
                clientId: chance.word(),
                cskey: chance.word(),
                refreshtoken: chance.word()
              },
              hubspot: {
                apikey: chance.word()
              },
              kickbox: {
                apikey: chance.word()
              },
              office365: {
                cert: chance.word(),
                clientId: chance.word(),
                email: chance.word(),
                tenant: chance.word(),
                thumbprint: chance.word()
              },
              sqlconnector: {
                host: chance.word(),
                password: chance.word(),
                type: chance.word(),
                user: chance.word()
              }
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'commercial');
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('atlassian'), true);
            assert.equal(response.settings.hasOwnProperty('databases'), true);
            assert.equal(response.settings.hasOwnProperty('google'), true);
            assert.equal(response.settings.hasOwnProperty('hubspot'), true);
            assert.equal(response.settings.hasOwnProperty('kickbox'), true);
            assert.equal(response.settings.hasOwnProperty('office365'), true);
            assert.equal(response.settings.hasOwnProperty('sqlconnector'), true);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Commercial plan will be able to create environments', function(done) {
        const otherProject = {
          title: chance.word(),
          description: chance.sentence(),
          project: template.project._id
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(otherProject)
          .expect(201)
          .end(done);
      });

      it('A Project on the Commercial plan will be able to use the default email provider', function(done){
        request(app)
          .get('/project/' + template.project._id + '/form/' + formId + '/actions')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res){
            if (err) {
             return done(err);
            }
            const emailAction = _.findIndex(res.body, action=> action.name === 'email')
            assert.notEqual(emailAction, -1);
            done();
          })

      })
    });

    describe('Upgrading Plans', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'basic'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.plan, 'basic');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });


      it('Anonymous users should not be allowed to upgrade a project', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .send({plan: 'independent'})
          .expect('Content-Type', /text\/plain/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err)
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'basic', done);
          });
      });

      it('Authenticated users should not be allowed to upgrade a project', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.users.user1.token)
          .send({plan: 'independent'})
          .expect('Content-Type', /text\/plain/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err)
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'basic', done);
          });
      });

      it('Admins should not be allowed to upgrade a project', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.users.admin.token)
          .send({plan: 'independent'})
          .expect('Content-Type', /text\/plain/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err)
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'basic', done);
          });
      });

      it('Upgrading to invalid plan should not be allowed', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: '}}}}'})
          .expect('Content-Type', /text\/html/)
          .expect(400)
          .end(function(err, res) {
            if (err) {
              return done(err)
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'basic', done);
          });
      });

      if (!customer)
      it('Upgrading without a registered payment method should not be allowed', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'independent'})
          .expect('Content-Type', /text\/html/)
          .expect(400)
          .end(function(err, res) {
            if (err) {
              return done(err)
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'basic', done);
          });
      });

      if (!docker)
      it('Saving a payment method', function(done) {
        app.formio.config.payeezy = {
          keyId: 'lFGgmH7ibDkNdCV6LiSbFdmSFXtIVncD', // Test Key
          host: 'api-cert.payeezy.com',
          endpoint: '/v1/transactions',
          gatewayId: 'AJ1234-01',
          gatewayPassword: '12345678901234567890123456789012',
          hmacKey: '0efeeaf6f21fdd71e5076dea683b3a11614972d7d8e798d42624b8f999597355', // Test Secret
          merchToken: 'fdoa-9b1a70e39b4f6b4fb0cef1c25de68010625408dc0b1025ae' // Test Token
        };

        const paymentData = {
          ccNumber: '4012000033330026',
          ccType: 'visa',
          ccExpiryMonth: '12',
          ccExpiryYear: '30',
          cardholderName: 'FORMIO Test Account',
          securityCode: '123'
        };

        request(app)
          .post('/payeezy')
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            data: paymentData
          })
          .expect('Content-Type', /text\/plain; charset=utf-8/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            Q(app.formio.formio.resources.form.model.findOne({name: 'paymentAuthorization'}))
            .then(function(form) {
              return app.formio.formio.resources.submission.model.findOne({form: form._id, owner: util.ObjectId(template.formio.owner._id)});
            })
            .then(function(submission) {
              assert.equal(submission.data.ccNumber, '************0026', 'Only the last 4 digits of the cc number should be stored.');
              assert.equal(submission.data.ccExpiryMonth, '12', 'The expiration month should be stored.');
              assert.equal(submission.data.ccExpiryYear, '30', 'The expiration year should be stored.');
              assert.equal(submission.data.cardholderName, 'FORMIO Test Account', 'The cardholder name should be stored.');
              assert(submission.data.token.token_data.value.substr(-4) === '0026', 'The transarmor token should have the same last 4 digits as CC number.');
              assert(submission.data.hasOwnProperty('transactionTag'), 'The submission should store the transactionTag');
              assert.equal(submission.data.securityCode, undefined, 'The security card should not be stored.');

              done();
            })
            .catch(function(err) {
              done(err);
            });
          });
      });
/*
      if (!docker)
      it('Upgrading to independent with a registered payment method should work', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'independent'})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'independent', function(err) {
              if (err) {
                return done(err);
              }
              Q(app.formio.formio.resources.form.model.findOne({name: 'projectUpgradeHistory'}))
              .then(function(form) {
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: util.ObjectId(template.formio.owner._id)}).sort('-created');
              })
              .then(function(submissions) {
                assert.equal(submissions.length, 1, 'There should only be one upgrade history submission.');
                assert.equal(submissions[0].data.projectId, template.project._id, 'The history entry should have the correct project _id');
                assert.equal(submissions[0].data.oldPlan, 'basic', 'The history entry should have the correct old plan');
                assert.equal(submissions[0].data.newPlan, 'independent', 'The history entry should have the correct new plan');

                done();
              })
              .catch(function(err) {
                done(err);
              });

            });
          });
      });

      if (!docker)
      it('Upgrading to team with a registered payment method should work', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'team'})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'team', function(err) {
              if (err) {
                return done(err);
              }
              Q(app.formio.formio.resources.form.model.findOne({name: 'projectUpgradeHistory'}))
              .then(function(form) {
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: util.ObjectId(template.formio.owner._id)}).sort('-created');
              })
              .then(function(submissions) {
                assert.equal(submissions.length, 2, 'There should be two upgrades history submission.');
                assert.equal(submissions[0].data.projectId, template.project._id, 'The history entry should have the correct project _id');
                assert.equal(submissions[0].data.oldPlan, 'independent', 'The history entry should have the correct old plan');
                assert.equal(submissions[0].data.newPlan, 'team', 'The history entry should have the correct new plan');

                done();
              })
              .catch(function(err) {
                done(err);
              });
            });
          });
      });

      if (!docker)
      it('Upgrading to commercial with a registered payment method should work', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'commercial'})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'commercial', function(err) {
              if (err) {
                return done(err);
              }
              Q(app.formio.formio.resources.form.model.findOne({name: 'projectUpgradeHistory'}))
              .then(function(form) {
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: util.ObjectId(template.formio.owner._id)}).sort('-created');
              })
              .then(function(submissions) {
                assert.equal(submissions.length, 3, 'There should be three upgrades history submission.');
                assert.equal(submissions[0].data.projectId, template.project._id, 'The history entry should have the correct project _id');
                assert.equal(submissions[0].data.oldPlan, 'team', 'The history entry should have the correct old plan');
                assert.equal(submissions[0].data.newPlan, 'commercial', 'The history entry should have the correct new plan');

                done();
              })
              .catch(function(err) {
                done(err);
              });
            });
          });
      });

      if (!docker)
      it('Downgrading to team with a registered payment method should work', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'team'})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'team', function(err) {
              if (err) {
                return done(err);
              }
              Q(app.formio.formio.resources.form.model.findOne({name: 'projectUpgradeHistory'}))
              .then(function(form) {
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: util.ObjectId(template.formio.owner._id)}).sort('-created');
              })
              .then(function(submissions) {
                assert.equal(submissions.length, 4, 'There should be four upgrades history submission.');
                assert.equal(submissions[0].data.projectId, template.project._id, 'The history entry should have the correct project _id');
                assert.equal(submissions[0].data.oldPlan, 'commercial', 'The history entry should have the correct old plan');
                assert.equal(submissions[0].data.newPlan, 'team', 'The history entry should have the correct new plan');

                done();
              })
              .catch(function(err) {
                done(err);
              });
            });
          });
      });

      if (!docker)
      it('Downgrading to independent with a registered payment method should work', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'independent'})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'independent', function(err) {
              if (err) {
                return done(err);
              }
              Q(app.formio.formio.resources.form.model.findOne({name: 'projectUpgradeHistory'}))
              .then(function(form) {
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: util.ObjectId(template.formio.owner._id)}).sort('-created');
              })
              .then(function(submissions) {
                assert.equal(submissions.length, 5, 'There should be five upgrades history submission.');
                assert.equal(submissions[0].data.projectId, template.project._id, 'The history entry should have the correct project _id');
                assert.equal(submissions[0].data.oldPlan, 'team', 'The history entry should have the correct old plan');
                assert.equal(submissions[0].data.newPlan, 'independent', 'The history entry should have the correct new plan');

                done();
              })
              .catch(function(err) {
                done(err);
              });
            });
          });
      });

      // Need to downgrade back to basic for the rest of the tests
      if (!docker)
      it('Downgrading to basic with a registered payment method should work', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'basic'})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            confirmProjectPlan(template.project._id, template.formio.owner, 'basic', function(err) {
              if (err) {
                return done(err);
              }
              Q(app.formio.formio.resources.form.model.findOne({name: 'projectUpgradeHistory'}))
              .then(function(form) {
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: util.ObjectId(template.formio.owner._id)}).sort('-created');
              })
              .then(function(submissions) {
                assert.equal(submissions.length, 6, 'There should only be six upgrade history submissions.');
                assert.equal(submissions[0].data.projectId, template.project._id, 'The history entry should have the correct project _id');
                assert.equal(submissions[0].data.oldPlan, 'independent', 'The history entry should have the correct old plan');
                assert.equal(submissions[0].data.newPlan, 'basic', 'The history entry should have the correct new plan');

                done();
              })
              .catch(function(err) {
                done(err);
              });

            });
          });
      });
      */
    });
  });

  // This is disabled until we set up customer testing again. This should not be allowed for hosted or docker version. Only customers.
  if (!docker) {
    return;
  }
  describe('Separate Collections', function() {
    let helper = null;
    let project = null;
    let collectionName = '';
    before(function(done) {
      process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
      helper = new Helper(template.formio.owner);
      helper.project().execute((err) => {
        if (err) {
          return done(err);
        }
        collectionName = `${helper.template.project.name  }_testing`;
        done();
      });
    });

    if (config.formio.hosted) {
      it('Should create a new form within the project', (done) => {
        helper.form('collection', [
          {
            type: 'textfield',
            key: 'firstName',
            label: 'First Name',
            input: true
          },
          {
            type: 'textfield',
            key: 'lastName',
            label: 'Last Name',
            input: true,
          },
          {
            type: 'email',
            key: 'email',
            label: 'Email',
            input: true,
          }
        ]).execute(done);
      });

      it('Should not allow you to configure the form to use separate collection', (done) => {
        assert(!helper.template.forms.collection.settings, 'Should not have any settings yet');
        helper.template.forms.collection.settings = {collection: 'testing'};
        request(app)
          .put(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .send(helper.template.forms.collection)
          .expect(200)
          .end(done);
      });

      it('Should upgrade the project to a Enterprise', function(done) {
        request(app)
          .post(`/project/${  helper.template.project._id  }/upgrade`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'commercial'})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });
    }

    it('Should allow you to configure the form to use separate collection', (done) => {
      helper.template.forms.collection.settings = {collection: 'testing', allowExistsEndpoint: true};
      request(app)
        .put(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`)
        .set('x-jwt-token', template.formio.owner.token)
        .send(helper.template.forms.collection)
        .expect(200)
        .end((err, res) => {
          assert.equal(res.body.settings.collection, 'testing');
          done();
        });
    });

    it('Should have configured the mongo database collection', (done) => {
      // Give the db time to build indexes.
      setTimeout(() => {
        app.formio.formio.mongoose.model('submission').collection.indexInformation((err, subIndexes) => {
          setTimeout(()=>{
          app.formio.formio.mongoose.model(collectionName).collection.indexInformation((err, indexes) => {
            assert(indexes.hasOwnProperty('data.email_1'), 'No email index found');
            assert(indexes['data.email_1'][0][0], 'data.email');
            assert(indexes['data.email_1'][0][1], 1);
            assert(indexes.hasOwnProperty('data.lastName_1'), 'No last name index found');
            assert(indexes['data.lastName_1'][0][0], 'data.lastName');
            assert(indexes['data.lastName_1'][0][1], 1);
            done();
          });
        }, 300);
        });
      }, 300);
    });

    it('Should remove all existing submissions in the previous collection', (done) => {
      app.formio.formio.mongoose.model(collectionName).remove({}, done);
    });

    it('Should be able to create some new submissions within the collection', (done) => {
      helper
      .submission('collection', {
          data: {
            firstName: 'Bob',
            lastName: 'Smith',
            email: 'bob@example.com'
          }
        })
        .submission('collection', {
          data: {
            firstName: 'Joe',
            lastName: 'Thompson',
            email: 'joe@example.com'
          }
        })
        .execute(done);
    });

    it('Should have saved these submissions within the Mongo collection', (done) => {
      app.formio.formio.mongoose.model(collectionName).find({}, (err, records) => {
        assert.equal(records.length, 2);
        assert.equal(records[0]._id, helper.template.submissions.collection[0]._id);
        assert.deepEqual(records[0].data, helper.template.submissions.collection[0].data);
        assert.equal(records[1]._id, helper.template.submissions.collection[1]._id);
        assert.deepEqual(records[1].data, helper.template.submissions.collection[1].data);
        done();
      });
    });

    it('Should also allow you to get a single submission', (done) => {
      let subUrl = `/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`;
      subUrl += `/submission/${  helper.template.submissions.collection[0]._id}`;
      request(app)
        .get(subUrl)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end((err, res) => {
          assert.equal(res.body._id, helper.template.submissions.collection[0]._id);
          assert.deepEqual(res.body.data, helper.template.submissions.collection[0].data);
          done();
        });
    });

    it('Should fetch the index view', (done) => {
      request(app)
        .get(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id  }/submission`)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end((err, res) => {
          assert.equal(res.body.length, 2);
          assert.deepEqual(res.body[0], _.find(helper.template.submissions.collection, {_id: res.body[0]._id}));
          assert.deepEqual(res.body[1], _.find(helper.template.submissions.collection, {_id: res.body[1]._id}));
          done();
        });
    });

    it('Should be able to update a submission', (done) => {
      helper.template.submissions.collection[0].data.email = 'updated@example.com';
      let subUrl = `/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`;
      subUrl += `/submission/${  helper.template.submissions.collection[0]._id}`;
      request(app)
        .put(subUrl)
        .set('x-jwt-token', template.formio.owner.token)
        .send(helper.template.submissions.collection[0])
        .expect(200)
        .end((err, res) => {
          assert.equal(res.body._id, helper.template.submissions.collection[0]._id);
          assert.deepEqual(res.body.data, helper.template.submissions.collection[0].data);
          app.formio.formio.mongoose.model(collectionName).findOne({_id: helper.template.submissions.collection[0]._id}, (err, record) => {
            if (err) {
              return done(err);
            }
            assert.equal(record.data.email, 'updated@example.com');
            done();
          });
        });
    });

    it('Should delete a submission', (done) => {
      helper.template.submissions.collection[0].data.email = 'updated@example.com';
      let subUrl = `/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`;
      subUrl += `/submission/${  helper.template.submissions.collection[0]._id}`;
      request(app)
        .delete(subUrl)
        .set('x-jwt-token', template.formio.owner.token)
        .end((err) => {
          app.formio.formio.mongoose.model(collectionName).findOne({_id: helper.template.submissions.collection[0]._id}, (err, record) => {
            if (err) {
              return done(err);
            }
            assert(record.deleted !== null, 'Record should be deleted.');
            done();
          });
        });
    });

    it('Submission Exists Endpoint should return data if a submissions exists', (done) => {
      request(app)
      .get(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id  }/exists?data.email=${ helper.template.submissions.collection[1].data.email }`)
      .set('x-jwt-token', template.formio.owner.token)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        assert.equal(res.body._id, helper.template.submissions.collection[1]._id);
        done();
      });
    });

    it('Submission Exists Endpoint should return 404 if it does not exist', (done) => {
      request(app)
      .get(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id  }/exists?data.email=${ helper.template.submissions.collection[0].data.email }`)
      .set('x-jwt-token', template.formio.owner.token)
      .expect(404)
      .end(done);
    });

    it('Sets a form to use submission revisions', done => {
      const updateForm = helper.template.forms.collection;
      updateForm.submissionRevisions = 'true';
      request(app)
      .put(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`)
      .set('x-jwt-token', template.formio.owner.token)
      .send(_.omit(updateForm, 'modified'))
      .expect(200)
      .end((err, res) => {
        assert.equal(res.body.submissionRevisions, 'true');
        done();
      });
    });

    it('Should create revisions for existed submission', done => {
        request(app)
        .get(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}/submission/${helper.template.submissions.collection[1]._id}/v`)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          const revisions = res.body;
          assert.equal(revisions.length, 1);
          assert.equal(revisions[0]._rid, helper.template.submissions.collection[1]._id);
          assert.equal(revisions[0]._vuser,template.formio.owner.data.email);
          assert.deepEqual(revisions[0].data, helper.template.submissions.collection[1].data);
          assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/firstName', value: 'Joe'});
          assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lastName', value: 'Thompson'});
          assert.deepEqual(revisions[0].metadata.jsonPatch[2], {op: 'add', path: '/data/email', value: 'joe@example.com'});
          done();
        });
    });

    it('Create Submission with enabled revisions', done => {
      helper
      .submission('collection', {
        data: {
          firstName: 'firstName',
          lastName: 'lastName',
          email: 'email@example.com'
        }
      })
      .expect(201)
      .execute((err, res)=> {
        if (err) {
          done(err);
        }
        request(app)
        .get(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}/submission/${helper.template.submissions.collection[2]._id}/v`)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          const revisions = res.body;
          assert.equal(revisions.length, 1);
          assert.equal(revisions[0]._rid, helper.template.submissions.collection[2]._id);
          assert.equal(revisions[0]._vuser,template.formio.owner.data.email);
          assert.deepEqual(revisions[0].data, helper.template.submissions.collection[2].data);
          assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/firstName', value: 'firstName'});
          assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lastName', value: 'lastName'});
          assert.deepEqual(revisions[0].metadata.jsonPatch[2], {op: 'add', path: '/data/email', value: 'email@example.com'});
          done();
        });
      });
    });

    it('Update Submission with enabled revisions', done => {
      const update = {
        firstName: 'firstNameUpdate',
        lastName: 'lastName',
        email: 'email@example.com'
      };

      const dataBeforeUpdate = {...helper.template.submissions.collection[2].data};
      const test = helper.template.submissions.collection[2];
      test.data = update;

      request(app)
       .put(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}/submission/${helper.template.submissions.collection[2]._id}`)
       .set('x-jwt-token', template.formio.owner.token)
       .send(_.omit(test, 'modified'))
       .expect('Content-Type', /json/)
       .expect(200)
       .end(function(err, res) {
        request(app)
        .get(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}/submission/${helper.template.submissions.collection[2]._id}/v`)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          const revisions = res.body;
          assert.equal(revisions.length, 2);
          assert.equal(revisions[0]._rid, helper.template.submissions.collection[2]._id);
          assert.equal(revisions[0]._vuser,template.formio.owner.data.email);
          assert.deepEqual(revisions[0].data, dataBeforeUpdate);
          assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/firstName', value: 'firstName'});
          assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lastName', value: 'lastName'});
          assert.deepEqual(revisions[0].metadata.jsonPatch[2], {op: 'add', path: '/data/email', value: 'email@example.com'});
          assert.equal(revisions[1]._rid, helper.template.submissions.collection[2]._id);
          assert.equal(revisions[1]._vuser,template.formio.owner.data.email);
          assert.deepEqual(revisions[1].data, update);
          assert.deepEqual(revisions[1].metadata.previousData, dataBeforeUpdate);
          assert.deepEqual(revisions[1].metadata.jsonPatch[0], {op: 'replace', path: '/data/firstName', value: 'firstNameUpdate'});
          done();
        });
      });
    });
  });
};
