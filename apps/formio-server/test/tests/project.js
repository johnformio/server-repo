/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const _ = require('lodash');
const Q = require('q');
const async = require('async');
const chance = new (require('chance'))();
const moment = require('moment');
const nock = require('nock');
const {createHmac} = require('node:crypto');
const {ObjectId} = require('formio/src/util/util');
const uuidRegex = /^([a-z]{15})$/;
const util = require('formio/src/util/util');
const config = require('../../config');
const docker = process.env.DOCKER;
const customer = process.env.CUSTOMER;
const portalSecret = process.env.PORTAL_SECRET;

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

  if (!config.formio.hosted)
  describe('Checking validation during project creation', function() {
    const testProject = {
      title: chance.word(),
      description: chance.word(),
      name: 'trainingProject',
      plan: 'commercial',
      type: 'project'
    };

    before((done) => {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send(testProject)
        .expect(201)
        .end(done)
    });

    it('Should not create project with the same name', function(done) {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send(testProject)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.text, 'project validation failed: name: The Project name must be unique.');
          done();
         });
    });

    it('Should not create project with non-valid project name', function(done) {
      testProject.name = "training project"
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send(testProject)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.text, 'project validation failed: name: A Project domain name may only contain letters, numbers, and hyphens (but cannot start or end with a hyphen)')
          done();
        });
    });
  })

  describe('Projects', function() {
    const tempProject = {
      title: chance.word(),
      description: chance.sentence(),
      template: _.pick(template, ['title', 'name', 'version', 'description', 'roles', 'resources', 'forms', 'actions', 'access']),
      type: 'project'
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
          //
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

    // It should create a submission in Info form of PDF Management project
    // when new project is created
    const pdfInfoSubmissions = [];
    if (config.formio.hosted) {
      before((done) => {
        nock(config.pdfProject, {
          reqheaders: {
            'x-token': (apiKey) => apiKey === config.pdfProjectApiKey
          }
        })
          .persist()
          .post('/info/submission', (body) => {
            assert(body.data.hasOwnProperty('project'), 'PDF info submission request should have #project property');
            assert(body.data.hasOwnProperty('lastConversion'), 'PDF info submission request should have #lastConversion property');
            assert(body.data.hasOwnProperty('token'), 'PDF info submission request should have #token property');
            assert(body.data.hasOwnProperty('host'), 'PDF info submission request should have #host property');

            assert.equal(body.data.plan, 'basic', 'PDF info submission request #plan property should be equal to "basic"');
            assert.equal(body.data.forms, '0', 'PDF info submission request #forms property should be equal to "0"');
            assert.equal(body.data.submissions, '0', 'PDF info submission request #submissions property should be equal to "0"');
            assert.equal(body.data.status, 'active', 'PDF info submission request #status property should be equal to "active"');

            pdfInfoSubmissions.push(body.data);
            return true;
          })
          .reply(200);
        done();
      });
    }

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

          // Check if PDF info submission was created
          if (config.formio.hosted) {
            const projectInfo = pdfInfoSubmissions.find(s => s.project === response._id);
            assert(projectInfo, 'Should create a submission in Info form of PDF Management project after new project is created');
          }

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

    describe('Raw data access', () => {
      const adminKey = chance.string({ length: 36 });
      const hashedAdminKey = createHmac('sha256', adminKey).digest('hex');

      const apiKey = chance.string({ length: 30 });
      const hashedApiKey = createHmac('sha256', apiKey).digest('hex');

      before(() => {
        process.env.ADMIN_KEY = adminKey;
      });

      it('Before: Should add API Key to project settings', done => {
        request(app)
          .put(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: {
            keys: [
              {
                name: chance.word(),
                key: apiKey,
              },
            ]
          }})
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.ok(project.settings, 'Project should have settings');
            assert.ok(project.settings.keys, 'Project should have "keys" field in settings');
            assert.ok(
              Array.isArray(project.settings.keys) &&
              project.settings.keys.length,
              'Project should have at least one API Key in settings'
            );
            assert.ok(project.settings.keys.some(({key}) => key === apiKey), 'Project should have API Key set in settings');

            template.project = project;
            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Before: Should create an administrator user', done => {
        request(app)
          .post(`/project/${template.forms.adminRegister.project}/form/${template.forms.adminRegister._id}/submission`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            data: {
              'email': template.users.admin.data.email,
              'password': template.users.admin.data.password
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const submission = res.body;

            assert.ok(submission.hasOwnProperty('_id'), 'Submission should have "_id" field returned');
            assert.ok(submission.data.hasOwnProperty('email'), 'Submission should have "email" field returned');
            assert.equal(submission.data.email, template.users.admin.data.email);
            assert.ok(!submission.data.hasOwnProperty('password'), 'Submission should not have "password" field returned');
            assert.ok(res.headers.hasOwnProperty('x-jwt-token'), 'Response should have "x-jwt-token" header returned');
            assert.equal(submission.roles[0].toString(), template.roles.administrator._id.toString());

            template.users.admin._id = submission._id;
            template.users.admin.form = submission.form;
            // Store the JWT for future API calls.
            template.users.admin.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should retrieve all project fields when Admin Key and valid x-raw-data-access header provided', done => {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-admin-key', process.env.ADMIN_KEY)
          .set('x-raw-data-access', hashedAdminKey)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.ok(project.hasOwnProperty('__v'), 'Project should have "__v" field returned');
            assert.ok(project.hasOwnProperty('deleted'), 'Project should have "deleted" field returned');
            assert.ok(project.hasOwnProperty('machineName'), 'Project should have "machineName" field returned');
            assert.ok(project.hasOwnProperty('primary'), 'Project should have "primary" field returned');
            assert.ok(project.hasOwnProperty('settings_encrypted'), 'Project should have "settings_encrypted" field returned');

            done();
          });
      });

      it('Should retrieve all project fields when API Key and valid x-raw-data-access header provided', done => {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-token', apiKey)
          .set('x-raw-data-access', hashedApiKey)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.ok(project.hasOwnProperty('__v'), 'Project should have "__v" field returned');
            assert.ok(project.hasOwnProperty('deleted'), 'Project should have "deleted" field returned');
            assert.ok(project.hasOwnProperty('machineName'), 'Project should have "machineName" field returned');
            assert.ok(project.hasOwnProperty('primary'), 'Project should have "primary" field returned');
            assert.ok(project.hasOwnProperty('settings_encrypted'), 'Project should have "settings_encrypted" field returned');

            done();
          });
      });

      it('Should not retrieve all project fields when only Admin Key provided', done => {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-admin-key', process.env.ADMIN_KEY)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.ok(!project.hasOwnProperty('__v'), 'Project should not have "__v" field returned');
            assert.ok(!project.hasOwnProperty('deleted'), 'Project should not have "deleted" field returned');
            assert.ok(!project.hasOwnProperty('machineName'), 'Project should not have "machineName" field returned');
            assert.ok(!project.hasOwnProperty('primary'), 'Project should not have "primary" field returned');
            assert.ok(!project.hasOwnProperty('settings_encrypted'), 'Project should not have "settings_encrypted" field returned');

            done();
          });
      });

      it('Should not retrieve all project fields when only API Key provided', done => {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-token', apiKey)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.ok(!project.hasOwnProperty('__v'), 'Project should not have "__v" field returned');
            assert.ok(!project.hasOwnProperty('deleted'), 'Project should not have "deleted" field returned');
            assert.ok(!project.hasOwnProperty('machineName'), 'Project should not have "machineName" field returned');
            assert.ok(!project.hasOwnProperty('primary'), 'Project should not have "primary" field returned');
            assert.ok(!project.hasOwnProperty('settings_encrypted'), 'Project should not have "settings_encrypted" field returned');

            done();
          });
      });

      it('Should return error when Admin user JWT token and valid x-raw-data-access header provided', done => {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.users.admin.token)
          .set('x-raw-data-access', hashedApiKey)
          .expect('Content-Type', /json/)
          .expect(400)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const error = res.body;

            assert.ok(error.hasOwnProperty('message'), 'Error should have "message" field returned');
            assert.equal(error.message, 'API Key or Admin Key are required for raw data access.');

            done();
          });
      });

      it('Should return error when Admin Key and invalid x-raw-data-access header provided', done => {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-admin-key', adminKey)
          .set('x-raw-data-access', chance.string({length: 36}))
          .expect('Content-Type', /json/)
          .expect(400)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const error = res.body;

            assert.ok(error.hasOwnProperty('message'), 'Error should have "message" field returned');
            assert.equal(error.message, 'Invalid raw data access header provided.');

            done();
          });
      });

      it('Should return error when API Key and invalid x-raw-data-access header provided', done => {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-token', apiKey)
          .set('x-raw-data-access', chance.string({length: 30}))
          .expect('Content-Type', /json/)
          .expect(400)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const error = res.body;

            assert.ok(error.hasOwnProperty('message'), 'Error should have "message" field returned');
            assert.equal(error.message, 'Invalid raw data access header provided.');

            done();
          });
      });

      it('After: Should remove API Key from project settings', done => {
        const projectApiKeys = _.get(template.project, 'settings.keys');

        if (!projectApiKeys || !Array.isArray(projectApiKeys) || !projectApiKeys.length) {
          return done(new Error('Project should have at least one API Key in settings'));
        }

        request(app)
          .put(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: {
            keys: projectApiKeys.filter(({key}) => key !== apiKey)
          }})
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.ok(project.settings, 'Project should have settings');
            assert.ok(project.settings.keys, 'Project should have "keys" field in settings');
            assert.ok(Array.isArray(project.settings.keys), 'Project settings "keys" field should be an Array');
            assert.ok(!project.settings.keys.find(({key}) => key === apiKey), 'Project should not have API Key set in settings');

            template.project = project;
            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('After: Should delete administrator user', done => {
        request(app)
          .delete(`/project/${template.forms.adminRegister.project}/form/${template.users.admin.form}/submission/${template.users.admin._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            delete template.users.admin._id;
            delete template.users.admin.form;
            delete template.users.admin.token;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          })
      });

      after(() => {
        delete process.env.ADMIN_KEY;
      });
    });

    describe('Stages', () => {
      const stagesIds = [];

      before(() => {
        process.env.ADMIN_KEY = chance.word();
      });

      it('Should create stage using default template when copying from empty stage', async () => {
        const defaultTemplate = app.formio.formio.templates.default;
        const stageTitle = chance.word();

        // Create stage
        const stageCreateRes = await request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            stageTitle,
            title: chance.word(),
            name: chance.word(),
            type: 'stage',
            project: template.project._id,
            copyFromProject: 'empty',
            framework: 'custom'
          });

        const stage = stageCreateRes.body;

        assert.ok(stage._id);
        assert.equal(stage.project, template.project._id);
        assert.equal(stage.stageTitle, stageTitle);
        assert.notEqual(stage.title, stageTitle);
        assert.equal(stage.plan, template.project.plan, 'Stage should inherit parent project plan.')

        stagesIds.push(stage._id);

        // Export stage template to compare with default template
        const exportStageRes = await request(app)
          .get(`/project/${stage._id}/export`)
          .set('x-jwt-token', template.formio.owner.token);

        const exportedStage = exportStageRes.body;

        assert.ok(exportedStage.version);
        assert.ok(exportedStage.title);
        assert.deepEqual(Object.keys(exportedStage.roles).sort(), Object.keys(defaultTemplate.roles).sort());
        assert.deepEqual(Object.keys(exportedStage.resources).sort(), Object.keys(defaultTemplate.resources).sort());
        assert.deepEqual(Object.keys(exportedStage.forms).sort(), Object.keys(defaultTemplate.forms).sort());
        assert.deepEqual(Object.keys(exportedStage.actions).sort(), Object.keys(defaultTemplate.actions).sort());
        assert.deepEqual(exportedStage.access, defaultTemplate.access);
      });

      it('Should create stage using project template when copying from existing stage', async () => {
        const stageTitle = chance.word();

        // Create stage
        const stageCreateRes = await request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            stageTitle,
            title: chance.word(),
            name: chance.word(),
            type: 'stage',
            project: template.project._id,
            copyFromProject: template.project._id,
            framework: 'custom'
          });

        const stage = stageCreateRes.body;

        assert.ok(stage._id);
        assert.equal(stage.project, template.project._id);
        assert.equal(stage.stageTitle, stageTitle);
        assert.notEqual(stage.title, stageTitle);
        assert.equal(stage.plan, template.project.plan, 'Stage should inherit parent project plan.')

        stagesIds.push(stage._id);

        // Export project template
        const exportProjectRes = await request(app)
          .get(`/project/${template.project._id}/export`)
          .set('x-jwt-token', template.formio.owner.token);

        const exportedProject = exportProjectRes.body;

        assert.ok(exportedProject.version);
        assert.ok(exportedProject.title);
        assert.ok(exportedProject.roles);
        assert.ok(exportedProject.resources);
        assert.ok(exportedProject.forms);
        assert.ok(exportedProject.actions);
        assert.ok(exportedProject.access);

        // Export stage template to compare with project template
        const exportStageRes = await request(app)
          .get(`/project/${stage._id}/export`)
          .set('x-jwt-token', template.formio.owner.token);

        const exportedStage = exportStageRes.body;

        assert.ok(exportedStage.version);
        assert.ok(exportedStage.title);
        assert.deepEqual(Object.keys(exportedStage.roles).sort(), Object.keys(exportedProject.roles).sort());
        assert.deepEqual(Object.keys(exportedStage.resources).sort(), Object.keys(exportedProject.resources).sort());
        assert.deepEqual(Object.keys(exportedStage.forms).sort(), Object.keys(exportedProject.forms).sort());
        assert.deepEqual(Object.keys(exportedStage.actions).sort(), Object.keys(exportedProject.actions).sort());
        assert.deepEqual(exportedStage.access, exportedProject.access);
      });

      it('Should create stage when admin key provided', done => {
        const newStage = {
          stageTitle: chance.word(),
          title: chance.word(),
          name: chance.word(),
          type: 'stage',
          project: template.project._id,
          copyFromProject: template.project._id,
          framework: 'custom'
        };

        request(app)
          .post('/project')
          .set('x-admin-key', process.env.ADMIN_KEY)
          .send(newStage)
          .expect(201)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const stage = res.body;

            assert.ok(stage._id);
            assert.equal(stage.type, 'stage');
            assert.equal(stage.project, template.project._id);
            assert.equal(stage.stageTitle, newStage.stageTitle);
            assert.equal(stage.title, newStage.title);
            assert.equal(stage.owner, template.project.owner);

            done();
          });
      });

      it('Should reset defaultStage property after the default stage was deleted', done => {
        const newStage = {
          stageTitle: chance.word(),
          title: chance.word(),
          name: chance.word(),
          type: 'stage',
          project: template.project._id,
          copyFromProject: template.project._id,
          framework: 'custom'
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(newStage)
          .expect(201)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const stage = res.body;

            assert.ok(stage._id);

            request(app)
              .put('/project/' + template.project._id)
              .set('x-jwt-token', template.formio.owner.token)
              .send({settings: {
                ...template.project.settings,
                defaultStage: stage._id,
              }})
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                const response = res.body;
                assert.equal(response.hasOwnProperty('settings'), true);
                assert.equal(response.settings.defaultStage, stage._id);

                template.project = response;

                // Store the JWT for future API calls.
                template.formio.owner.token = res.headers['x-jwt-token'];

                request(app)
                  .delete('/project/' + stage._id)
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

                    app.formio.formio.resources.project.model.find({_id: template.project._id})
                      .exec(function (err, results) {
                        if (err) {
                          return done(err);
                        }

                        assert.equal(results[0].settings.defaultStage, '', 'Should reset default stage property');
                        done();
                      });
                  });
              });
          });
      });

      after(async () => {
        delete process.env.ADMIN_KEY;
        // Delete created stages
        await Promise.all(stagesIds.map(stageId => request(app)
          .delete(`/project/${stageId}`)
          .set("x-jwt-token", template.formio.owner.token)
        ));
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

    describe('Primary write access configuration', () => {
      before(async () => {
        // Create and admin user for formio project
        const adminCreateRes = await request(app)
        .post(`/project/${template.formio.primary._id}/form/${template.formio.adminResource._id}/submission`)
          .send({
            data: {
              email: template.users.admin.data.email,
              password: template.users.admin.data.password
            }
          })
          .set('x-jwt-token', template.formio.owner.token);

        const admin = adminCreateRes.body;

        assert.ok(admin._id);
        assert.ok(admin.data);
        assert.equal(admin.data.email, template.users.admin.data.email);
        assert.equal(admin.roles.length, 1);
        assert.equal(admin.project, template.formio.primary._id);

        template.users.admin._id = admin._id;

        // Update login action for Login form to include Admin resource
        const actionsRes = await request(app)
          .get(`/project/${template.formio.primary._id}/form/${template.formio.formLogin._id}/action`)
          .set('x-jwt-token', template.formio.owner.token);

        const actions = actionsRes.body;

        assert.ok(actions.length);

        const loginAction = actions.find(action => action.name === 'login');

        assert.ok(loginAction._id);
        assert.ok(loginAction.settings.resources);

        const actionUpdateRes = await request(app)
          .put(`/project/${template.formio.primary._id}/form/${template.formio.formLogin._id}/action/${loginAction._id}`)
          .send({
            settings: {
              ...loginAction.settings,
              resources: [
                ...loginAction.settings.resources,
                template.formio.adminResource._id
              ]
            }
          })
          .set('x-jwt-token', template.formio.owner.token);

        const updatedAction = actionUpdateRes.body;

        assert.equal(updatedAction._id, loginAction._id);
        assert.ok(updatedAction.settings.resources.some(res => res === template.formio.adminResource._id));

        // log in as admin user
        const loginRes = await request(app)
          .post(`/project/${template.formio.primary._id}/user/login`)
          .send({
            data: {
              email: template.users.admin.data.email,
              password: template.users.admin.data.password
            }
          });

        const login = loginRes.body;

        assert.equal(login.data.email, template.users.admin.data.email);
        // Store the JWT for future API calls.
        template.users.admin.token = loginRes.headers['x-jwt-token'];

        // Activate ONLY_PRIMARY_WRITE_ACCESS configuration
        config.onlyPrimaryWriteAccess = true;
      });

      it('Should allow admin user to create new project', done => {
        request(app)
          .post('/project')
          .set('x-jwt-token', template.users.admin.token)
          .send({
            framework: 'custom',
            title: 'Test Project',
            stageTitle: 'Live',
            type: 'project',
            settings: {
              cors: '*'
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.ok(project._id);
            assert.equal(project.title, 'Test Project');
            assert.equal(project.owner, template.users.admin._id);

            done();
          });
      });

      it('Should allow admin user to create new team', done => {
        request(app)
          .post('/team')
          .set('x-jwt-token', template.users.admin.token)
          .send({
            data: {
              name: 'Test Team'
            }
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const team = res.body;

            assert.ok(team._id);
            assert.equal(team.owner, template.users.admin._id);

            done();
          });
      });

      it('Should not allow non-admin user to create new project', done => {
       request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          framework: 'custom',
          title: 'Test Project',
          stageTitle: 'Live',
          settings: {
            cors: '*'
          }
        })
        .expect(403)
        .end(done);
      });

      it('Should not allow non-admin user to create new team', done => {
        request(app)
        .post('/team')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          data: {
            name: 'Test Team'
          }
        })
        .expect(403)
        .end(done);
      });

      after(() => {
        // Deactivate ONLY_PRIMARY_WRITE_ACCESS configuration
        config.onlyPrimaryWriteAccess = false;
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

  describe('Should not allow to sync license utilization if project type is not provided', () => {
    it('Should throw error on project creation if type is missing', done => {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          title: chance.word(),
          description: chance.word(),
          name: chance.word(),
          plan: 'trial'
        })
        .expect(400)
        .expect('Project type must be provided.')
        .end(done);
    });

    it('Should throw error on project creation from template if type is missing', done => {
      const projectTemplate = require('./fixtures/excludeAccessTemplate.json');
      delete projectTemplate.type;

      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send(projectTemplate)
        .expect(400)
        .expect('Project type must be provided.')
        .end(done);
    });

    it('Should throw error on project creation if invalid type provided', done => {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          title: chance.word(),
          description: chance.word(),
          name: chance.word(),
          plan: 'trial',
          type: 'pr0ject'
        })
        .expect(400)
        .expect('Invalid project type. Allowed values are: project, stage, tenant.')
        .end(done);
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

    before((done) => {
      process.env.ADMIN_KEY = 'examplekey';
      done();
    });

    describe('X-ADMIN-KEY', () => {
      let prevProjectPlan = process.env.PROJECT_PLAN;
      let projectForUpdate;

      before((done) => {
        process.env.PROJECT_PLAN = 'trial';
        done();
      });

      it('User should be able to provide plan during project creation using x-admin-token', (done) => {
        const attempt = chance.word({length: 10});
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          name: attempt,
          plan: 'commercial',
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.plan, 'commercial');
            done();
          });
      });

      it('A Registered user should not be able to provide plan during project creation', (done) => {
        const attempt = chance.word({length: 10});
        const tempProject = {
          title: chance.word(),
          description: chance.sentence(),
          name: attempt,
          plan: 'commercial',
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(tempProject)
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.plan, 'trial');
            projectForUpdate = res.body;
            done();
          });
      });

      it('A Registered user should not be able to provide plan during project updating', (done) => {
        request(app)
          .put(`/project/${projectForUpdate._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            plan: 'commercial',
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.plan, 'trial');
            done();
          });
      });

      it('User should be able to provide plan during project updating using x-admin-token', (done) => {
        request(app)
          .put(`/project/${projectForUpdate._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .set('x-admin-key', process.env.ADMIN_KEY)
          .send({
            plan: 'commercial',
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.plan, 'commercial');
            done();
          });
      });

      after((done) => {
        process.env.PROJECT_PLAN = prevProjectPlan;
        done();
      });
    });

    describe('Archived Plan', () => {
      let originalProject;

      const testForm = {
        title: chance.word(),
        name: chance.word(),
        path: chance.word(),
        type: 'form',
        components: [
          {
            label: 'Text Field',
            key: 'textField',
            type: 'textfield',
            input: true
          }
        ]
      };

      const testResource = {
        title: chance.word(),
        name: chance.word(),
        path: chance.word(),
        type: 'resource',
        components: [
          {
            label: 'Text Field',
            key: 'textField',
            type: 'textfield',
            input: true
          }
        ]
      };

      const testSubmission = {
        data: {
          textField: 'Test Submission'
        },
        metadata: {}
      };

      const testAction = {
        data: {
          priority: 0,
          name: "email",
          title: "Email",
          settings: {
            transport: "default",
            from: "no-reply@example.com",
            replyTo: "",
            emails: ["test@example.com"],
            sendEach: false,
            cc: [""],
            bcc: [""],
            subject: "New submission for {{ form.title }}.",
            template: "https://pro.formview.io/assets/email.html",
            message: "{{ submission(data, form.components) }}",
            renderingMethod: "dynamic",
            attachFiles: false,
            attachPDF: false,
          },
          handler: ["after"],
          method: ["create"],
          condition: {
            field: {},
            eq: "",
            value: "",
            custom: "",
          },
          submit: true,
        },
        metadata: {}
      };

      before(async () => {
        // Store original project for future restore
        originalProject = _.cloneDeep(template.project);
        // Create test stage
        const stageTitle = chance.word();
        const stageCreateRes = await request(app)
          .post('/project')
          .send({
            title: chance.word(),
            type: "stage",
            project: template.project._id,
            copyFromProject: "empty",
            name: chance.word(),
            stageTitle,
            settings: {
              cors: "*",
            },
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(201);

        const stage = stageCreateRes.body;

        assert.equal(stage.stageTitle, stageTitle);
        assert.equal(stage.type, 'stage');
        assert.equal(stage.plan, template.project.plan, 'Stage should inherit parent project plan');

        template.stage = stage;

        // Create a couple of teams
        const team1Name = chance.word();
        const team1CreateRes = await request(app)
          .post('/team')
          .send({
            data: {
              name: team1Name
            }
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(201);

        const team1 = team1CreateRes.body;

        assert.ok(team1._id);
        assert.equal(team1.data.name, team1Name);

        template.team1 = team1;

        const team2Name = chance.word();
        const team2CreateRes = await request(app)
          .post('/team')
          .send({
            data: {
              name: team2Name
            }
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(201);

        const team2 = team2CreateRes.body;

        assert.ok(team2._id);
        assert.equal(team2.data.name, team2Name);

        template.team2 = team2;

        // Create form
        const formCreateRes = await request(app)
          .post(`/project/${template.project._id}/form`)
          .send(testForm)
          .set('x-jwt-token', template.formio.owner.token);

        const form = formCreateRes.body;

        assert.ok(form._id);
        assert.equal(form.title, testForm.title);
        assert.equal(form.name, testForm.name);

        template.forms[testForm.name] = form;

        // Create resource
        const resourceCreateRes = await request(app)
          .post(`/project/${template.project._id}/form`)
          .send(testResource)
          .set('x-jwt-token', template.formio.owner.token);

        const resource = resourceCreateRes.body;

        assert.ok(resource._id);
        assert.equal(resource.title, testResource.title);
        assert.equal(resource.name, testResource.name);

        template.resources[testResource.name] = resource;

        // Create submission
        if (!template.submissions) {
          template.submissions = {};
        }

        const submissionCreateRes = await request(app)
          .post(`/project/${template.project._id}/form/${form._id}/submission`)
          .send(testSubmission)
          .set('x-jwt-token', template.formio.owner.token);

        const submission = submissionCreateRes.body;

        assert.ok(submission._id);
        assert.deepEqual(submission.data, testSubmission.data);

        template.submissions[form._id] = submission;

        // Update project to set trial plan and assign to team1
        const projectUpdateRes = await request(app)
          .put(`/project/${template.project._id}`)
          .send({
            access: [ ...template.project.access, { type: 'team_read', roles: [template.team1._id] }],
            plan: 'trial'
          })
          .set('x-jwt-token', template.formio.owner.token);

        const project = projectUpdateRes.body;

        assert.equal(project.plan, 'trial');
        assert.ok(project.access.some(({ type, roles }) => type === 'team_read' && roles[0] === team1._id));

        template.project = project;

        // Store the JWT for future API calls.
        template.formio.owner.token = projectUpdateRes.headers['x-jwt-token'];
      });

      it('Should archive project when trial time ends', async () => {
        // Set project trial time to be expired
        const monthAgo = moment().subtract(1, 'month').toDate();
        const projectUpdateRes = await request(app)
          .put(`/project/${template.project._id}`)
          .send({
            trial: monthAgo
          })
          .set('x-jwt-token', template.formio.owner.token);

        const updatedProject = projectUpdateRes.body;

        assert.equal(updatedProject.plan, 'trial');
        assert.equal(updatedProject.trial, monthAgo.toISOString());

        // Do a GET request to trigger trial time expiration check
        await request(app)
          .get(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token)

        // Check the project got archived
        const projectRes = await request(app)
          .get(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200);

        const project = projectRes.body;

        assert.equal(project.plan, 'archived');

        template.project = project;
        app.formio.formio.cache.deleteProjectCache(template.project);
      });

      it('Should not allow to create new stage', done => {
        request(app)
          .post("/project")
          .send({
            title: "New stage",
            type: "stage",
            project: template.project._id,
            copyFromProject: "empty",
            name: "new-stage",
            stageTitle: "New stage",
            settings: {
              cors: "*",
            },
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to delete existing stage', done => {
        request(app)
          .delete(`/project/${template.stage._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to update project settings', done => {
        request(app)
          .put(`/project/${template.project._id}`)
          .send({
            settings: {
              allowConfig: true,
            },
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to add team', done => {
        request(app)
          .put(`/project/${template.project._id}`)
          .send({
            access: [ ...template.project.access, { type: 'team_write', roles: [template.team2._id] }],
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to remove team', done => {
        request(app)
          .put(`/project/${template.project._id}`)
          .send({
            access: [ ...template.project.access, { type: 'team_read', roles: [] }],
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to change project access', done => {
        request(app)
          .put(`/project/${template.project._id}`)
          .send({
            access: [
              ...template.project.access,
              { type: 'create_all', roles: [template.roles['anonymous']._id] },
              { type: 'read_all', roles: [template.roles['anonymous']._id] },
              { type: 'update_all', roles: [template.roles['anonymous']._id] },
              { type: 'delete_all', roles: [template.roles['anonymous']._id] }
            ],
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to create new form', done => {
        request(app)
          .post(`/project/${template.project._id}/form`)
          .send(testForm)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to create new resource', done => {
        request(app)
          .post(`/project/${template.project._id}/form`)
          .send(testResource)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to update form', done => {
        request(app)
          .put(`/project/${template.project._id}/form/${template.forms[testForm.name]._id}`)
          .send({
            ...testForm,
            title: 'Updated Form Title'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to update resource', done => {
        request(app)
          .put(`/project/${template.project._id}/form/${template.resources[testResource.name]._id}`)
          .send({
            ...testResource,
            title: 'Updated Resource Title'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to delete form', done => {
        request(app)
          .delete(`/project/${template.project._id}/form/${template.forms[testForm.name]._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to create new form submission', done => {
        request(app)
          .post(`/project/${template.project._id}/form/${template.forms[testForm.name]._id}/submission`)
          .send({
            data: {
              textField: 'New Submission'
            }
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to create new resource submission', done => {
        request(app)
          .post(`/project/${template.project._id}/form/${template.resources[testResource.name]._id}/submission`)
          .send({
            data: {
              textField: 'New Submission'
            }
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to update submission', done => {
        const formId = template.forms[testForm.name]._id;

        request(app)
          .put(`/project/${template.project._id}/form/${formId}/submission/${template.submissions[formId]._id}`)
          .send({
            data: {
              textField: 'New Submission'
            }
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to delete submission', done => {
        const formId = template.forms[testForm.name]._id;

        request(app)
          .delete(`/project/${template.project._id}/form/${formId}/submission/${template.submissions[formId]._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to create form action', done => {
        const formId = template.forms[testForm.name]._id;

        request(app)
          .post(`/project/${template.project._id}/form/${formId}/action`)
          .send(testAction)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to change form access', done => {
        const form = template.forms[testForm.name];

        request(app)
          .put(`/project/${template.project._id}/form/${form._id}`)
          .send({
            access: [
              ...form.access,
              { type: 'create_own', roles: [template.roles['anonymous']._id] },
              { type: 'read_own', roles: [template.roles['anonymous']._id] },
              { type: 'update_own', roles: [template.roles['anonymous']._id] },
              { type: 'delete_own', roles: [template.roles['anonymous']._id] }
            ]
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to enable form revisions', done => {
        const formId = template.forms[testForm.name]._id;

        request(app)
          .put(`/project/${template.project._id}/form/${formId}`)
          .send({
            revisions: 'current'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should not allow to enable form submission revisions', done => {
        const formId = template.forms[testForm.name]._id;

        request(app)
          .put(`/project/${template.project._id}/form/${formId}`)
          .send({
            submissionRevisions: 'true'
          })
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .expect('This is not allowed for an Archived project.')
          .end(done);
      });

      it('Should allow OPTIONS requests', async () => {
        const testFormId = template.forms[testForm.name]._id;

        // Project
        await request(app)
          .options(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token);

        // Form
        await request(app)
          .options(`/project/${template.project._id}/form/${testFormId}`)
          .set('x-jwt-token', template.formio.owner.token);

        // Submission
        await request(app)
          .options(`/project/${template.project._id}/form/${testFormId}/submission/${template.submissions[testFormId]._id}`)
          .set('x-jwt-token', template.formio.owner.token);
      });

      it('Should allow to get project', done => {
        request(app)
          .get(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const project = res.body;

            assert.equal(project._id, template.project._id);
            assert.equal(project.type, 'project');
            assert.equal(project.plan, 'archived');

            done();
          });
      });

      it('Should allow to get form', done => {
        const formId = template.forms[testForm.name]._id;

        request(app)
          .get(`/project/${template.project._id}/form/${formId}`)
          .set('x-jwt-token', template.formio.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const form = res.body;

            assert.equal(form._id, formId);
            assert.equal(form.type, 'form');

            done();
          });
      });

      it('Should allow to get resource', done => {
        const resourceId = template.resources[testResource.name]._id;

        request(app)
          .get(`/project/${template.project._id}/form/${resourceId}`)
          .set('x-jwt-token', template.formio.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const resource = res.body;

            assert.equal(resource._id, resourceId);
            assert.equal(resource.type, 'resource');

            done();
          });
      });

      it('Should allow to get submission', done => {
        const formId = template.forms[testForm.name]._id;
        const submissionId = template.submissions[formId]._id;

        request(app)
          .get(`/project/${template.project._id}/form/${formId}/submission/${submissionId}`)
          .set('x-jwt-token', template.formio.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const submission = res.body;

            assert.equal(submission._id, submissionId);
            assert.equal(submission.form, formId);
            assert.ok(submission.data);

            done();
          });
      });

      it('Should allow to export project', done => {
        request(app)
          .get(`/project/${template.project._id}/export`)
          .set('x-jwt-token', template.formio.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const projectExport = res.body;

            assert.ok(projectExport.version);
            assert.ok(projectExport.title);
            assert.ok(projectExport.name);
            assert.ok(projectExport.access);
            assert.ok(projectExport.forms);
            assert.ok(projectExport.resources);
            assert.ok(projectExport.roles);

            assert.ok(
              projectExport.forms[testForm.name] &&
              projectExport.forms[testForm.name].name === testForm.name,
              'Should have previously created form'
            );
            assert.ok(
              projectExport.resources[testResource.name] &&
              projectExport.resources[testResource.name].name === testResource.name,
              'Should have previously created resource'
            );

            done();
          });
      });

      after(async () => {
        const db = app.formio.formio.mongoose.connection.db;

        // Restore the project
        await db.collection('projects').updateOne({
          _id: ObjectId(template.project._id)
        }, {
          $set: _.omit(originalProject, '_id')
        });

        app.formio.formio.cache.deleteProjectCache(template.project);

        // Delete created teams
        await request(app)
          .delete(`/team/${template.team1._id}`)
          .set('x-jwt-token', template.formio.owner.token);

        delete template.team1;

        await request(app)
          .delete(`/team/${template.team2._id}`)
          .set('x-jwt-token', template.formio.owner.token);

        delete template.team2;

        // Delete created form
        await request(app)
          .delete(`/project/${template.project._id}/form/${template.forms[testForm.name]._id}`)
          .set('x-jwt-token', template.formio.owner.token);

        delete template.forms[testForm.name];
      });
    });

    describe('Basic Plan', function() {
      let initialEnvProjectPlan;
      let initialFormioConfigProjectPlan;

      before((done) => {
        initialEnvProjectPlan = process.env.PROJECT_PLAN;
        initialFormioConfigProjectPlan = app.formio.config.plan;
        process.env.PROJECT_PLAN = 'basic';
        app.formio.config.plan = 'basic';
        done();
      });

      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'basic'
          })
          .set('x-admin-key', process.env.ADMIN_KEY)
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
      });

      // Only applicable for hosted env with enabled restrictions
      if (config.formio.hosted) {
        it('Project template importing should return error if exceeding plan limit', function(done){
          const prevEnableRestrictions = config.enableRestrictions;
          config.enableRestrictions = true;
          const importTemplate = {
            template: {
              version: '2.0.0',
              forms: {},
              resources: {
                '01': {
                  title: '01',
                  type: 'resource',
                  name: '01',
                  path: '01',
                  components: []
                },
                '02': {
                  title: '02',
                  type: 'resource',
                  name: '02',
                  path: '02',
                  components: []
                },
                '03': {
                  title: '03',
                  type: 'resource',
                  name: '03',
                  path: '03',
                  components: []
                }
              },
              excludeAccess: true
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/import')
            .set('x-jwt-token', template.formio.owner.token)
            .send(importTemplate)
            .expect('Content-Type', /text\/html/)
            .expect(400)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.equal(res.text, 'Limit exceeded. Upgrade your plan.');

              config.enableRestrictions = prevEnableRestrictions;
              done();
            });
        });

        it('Project template importing should detect new forms and import template successfully', function(done){
          const prevEnableRestrictions = config.enableRestrictions;
          config.enableRestrictions = true;
          const resourceKeyFromTemplate = Object.keys(template.resources)[1];
          const resourceKeyFromTemplate2 = Object.keys(template.resources)[2];
          const resourceKeyFromTemplate3 = Object.keys(template.resources)[3];
          const importTemplate = {
            template: {
              version: '2.0.0',
              forms: {},
              resources: {
                [resourceKeyFromTemplate]: template.resources[resourceKeyFromTemplate],
                [resourceKeyFromTemplate2]: template.resources[resourceKeyFromTemplate2],
                [resourceKeyFromTemplate3]: template.resources[resourceKeyFromTemplate3]
              },
              excludeAccess: true
            }
          };

          request(app)
            .post('/project/' + template.project._id + '/import')
            .set('x-jwt-token', template.formio.owner.token)
            .send(importTemplate)
            .expect('Content-Type', /text/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              config.enableRestrictions = prevEnableRestrictions;
              done();
            });
        });

        it ('Project creation should exceed limit with huge template', function(done) {
          const prevEnableRestrictions = config.enableRestrictions;
          config.enableRestrictions = true;
          const forms = Array.apply(null, Array(15)).map(() => {
            const name = chance.word();
            return {
              title: name,
              type: 'form',
              name,
              path: name,
              components: [],
            }
          });
          const importTemplate = {
            version: '2.0.0',
            forms,
            resource: {},
            excludeAccess: true,
          };

          request(app)
            .post('/project')
            .set('x-jwt-token', template.formio.owner.token)
            .send({
              title: chance.word(),
              template: importTemplate,
            })
            .expect('Content-Type', /text\/html/)
            .expect(400)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.equal(res.text, 'Limit exceeded. Upgrade your plan.');

              config.enableRestrictions = prevEnableRestrictions;
              done();
            })
        });
      }

      it('Should be able to delete archived projects', function(done) {
        tempProjects[0].plan = 'archived';
        request(app)
        .delete('/project/' + tempProjects[0]._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200)
          .end(function(err, res){
            if (err) {
              return done(err);
            }
            done();
          })
      });

      after(function(done) {
        deleteProjects(tempProjects, done);
      });

      after((done) => {
        process.env.PROJECT_PLAN = initialEnvProjectPlan;
        app.formio.config.plan = initialFormioConfigProjectPlan;
        done();
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
          .set('x-admin-key', process.env.ADMIN_KEY)
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
          .set('x-admin-key', process.env.ADMIN_KEY)
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
          .set('x-admin-key', process.env.ADMIN_KEY)
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

      it('New Stage should inherit parent project plan', function(done) {
        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            title: chance.word(),
            type: 'stage',
            project: template.project._id,
            copyFromProject: 'empty',
            name: chance.word(),
            stageTitle: chance.word(),
            settings: {
              cors: '*',
            },
          })
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            const stage = res.body;
            assert.equal(stage.plan, 'commercial');
            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      })

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
          });
      });

      it('Create tenant', function(done) {
        const tenantTemplate = {
          "title": "tenantTemplateTest",
          "project": template.project._id,
          "type": "tenant",
          "copyFromProject": template.project._id
        };

        request(app)
          .post('/project')
          .send(tenantTemplate)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            const response = res.body;
            assert.equal(response.type, 'tenant');
            assert.equal(response.project, template.project._id);
            template.tenant = response;
            done();
          });
      });

      it('Should not be able to update CORS settings for tenant', function(done) {
        const newSettings = {
          cors: 'https://mysecuredomain.com,http://test-mysecuredomain.com',
          allowConfig: false,
          keys: [
            {
              name: 'Test Key',
              key: '123testing123testing'
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
          .put(`/project/${  template.tenant._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            ...template.tenant,
            settings: newSettings
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            const response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.deepEqual(response.settings, _.omit(newSettings, ['cors']));
            not(response, ['__v', 'deleted', 'settings_encrypted']);
          done();
        });
      });

      if (portalSecret) {
        it('Should create default forms and resources when creating remote stage', function(done) {
          request(app)
            .post('/project')
            .set('x-jwt-token', template.formio.owner.token)
            .send({
              title: 'Project for connecting remote',
              stageTitle: 'Live',
              settings: {
                cors: "*",
                remoteSecret: portalSecret
              }
            })
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, response) {
              if (err) {
                return done(err);
              }

              const project = response.body;

              request(app)
                .get(`/project/${project._id}/access/remote`)
                .set('x-jwt-token', template.formio.owner.token)
                .expect('Content-Type', /text/)
                .expect(200)
                .end(function(err, response) {
                  if (err) {
                    return done(err);
                  }

                  const remoteToken = response.text;
                  assert.notEqual(remoteToken.length, 0);
                  const remoteStage = {
                    name: chance.word(),
                    owner: project.owner,
                    project: project._id,
                    settings: {
                      cors: '*',
                      remoteSecret: portalSecret
                    },
                    title: 'remote stage',
                    type: 'stage'
                  }

                  request(app)
                    .post('/project/')
                    .set('x-remote-token', remoteToken)
                    .send(remoteStage)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, response) {
                      if (err) {
                        return done(err);
                      }

                      const remoteProject = response.body;

                      request(app)
                        .get(`/project/${remoteProject._id}/form`)
                        .set('x-remote-token', remoteToken)
                        .expect('Content-Type', /json/)
                        .expect(200)
                        .end(function(err, response) {
                          if (err) {
                            return done(err);
                          }

                          const forms = response.body;
                          const defaultFormsLength = 5;

                          assert.equal(forms.length, defaultFormsLength);
                          done();
                        })
                    })
                });
            });
        });
      }
    });

    describe('Upgrading Plans', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'basic'
          })
          .set('x-admin-key', process.env.ADMIN_KEY)
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
        app.formio.config.fortis = {
          userId: '11ee62159e8669aa9c22b6a1',
          userAPIKey: '11ee62356fc99e4686188771',
          endpoint: 'https://api.sandbox.fortis.tech/v1/transactions/cc/auth-only/keyed',
          developerId: 'IFoNlX7Z'
        };

        const paymentData = {
          ccNumber: '5454545454545454',
          ccType: 'MasterCard',
          ccExpiryMonth: '12',
          ccExpiryYear: '30',
          cardholderName: 'FORMIO Test Account',
          securityCode: '123'
        };

        request(app)
          .post('/gateway')
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
              assert.equal(submission.data.ccNumber, '5454', 'Only the last 4 digits of the cc number should be stored.');
              assert.equal(submission.data.ccExpiryMonth, '12', 'The expiration month should be stored.');
              assert.equal(submission.data.ccExpiryYear, '30', 'The expiration year should be stored.');
              assert.equal(submission.data.cardholderName, 'FORMIO Test Account', 'The cardholder name should be stored.');
              assert.equal(submission.data.transactionStatus, '102', 'The submission should store the transactionStatus');
              assert.equal(submission.data.securityCode, undefined, 'The security card should not be stored.');

              done();
            })
            .catch(function(err) {
              done(err);
            });
          });
      });

      if (!docker)
      it('Should upgrade project plan to commercial for archived project', async () => {
        // Set project plan to archived
        const projectUpdateRes = await request(app)
          .put(`/project/${template.project._id}`)
          .send({
            plan: 'archived'
          })
          .set('x-admin-key', process.env.ADMIN_KEY)
          .set('x-jwt-token', template.formio.owner.token);

        const updatedProject = projectUpdateRes.body;

        assert.equal(updatedProject.plan, 'archived');

        // Upgrade project plan to commercial
        await request(app)
          .post(`/project/${template.project._id}/upgrade`)
          .send({ plan: 'commercial' })
          .set('x-jwt-token', template.formio.owner.token);

        // Check the plan has changed
        const projectRes = await request(app)
          .get(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token);

        const project = projectRes.body;

        assert.equal(project.plan, 'commercial');

        //stage project plan should be updated as well
        const stageRes = await request(app)
          .get(`/project/${template.stage._id}`)
          .set('x-jwt-token', template.formio.owner.token);
        assert.equal(stageRes.body.plan, 'commercial');
      });

      if (!docker)
      it('Should downgrade project plan to basic', async () => {
        // Downgrade project plan to basic
        await request(app)
          .post(`/project/${template.project._id}/upgrade`)
          .send({ plan: 'basic' })
          .set('x-jwt-token', template.formio.owner.token);

        // Check the plan has changed
        const projectRes = await request(app)
          .get(`/project/${template.project._id}`)
          .set('x-jwt-token', template.formio.owner.token);

        const project = projectRes.body;

        assert.equal(project.plan, 'basic');

        //stage project plan should be updated as well
        const stageRes = await request(app)
          .get(`/project/${template.stage._id}`)
          .set('x-jwt-token', template.formio.owner.token);

        assert.equal(stageRes.body.plan, 'basic');
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

    after((done) => {
      delete process.env.ADMIN_KEY;
      done();
    });
  });

  describe('Form Defaults', function() {
    const helper = new Helper(template.formio.owner);
    const formDefaultsSetting = {
      submissionRevisions: 'true',
      settings: {
        theme: 'Darkly',
        showCheckboxBackground: true,
        layout: 'Landscape'
      },
      access: [],
      submissionAccess: [],
      tags: [
        'test'
      ],
      controller: 'console.log(111);'
    }

    before((done) => {
      helper.project().execute((err) => {
        if (err) {
          return done(err);
        }

        const roles = helper.template.roles;

        if (!_.isEmpty(roles)) {
            formDefaultsSetting.access.push({
              'roles': [
                roles.authenticated?._id
              ],
              'type': 'read_all'
            });

            formDefaultsSetting.submissionAccess.push({
              'roles': [
                roles.authenticated?._id,
                roles.administrator?._id
              ],
              'type': 'create_all'
            });
        }
        done();
      });
    });

    it('Should save formDefaults settings for the project', (done) => {
      request(app)
        .put('/project/' + helper.template.project._id)
        .set('x-jwt-token', template.formio.owner.token)
        .send({formDefaults: formDefaultsSetting })
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual(res.body.formDefaults, formDefaultsSetting);
          done();
        });
    });

    it('Should create a form with default settings configured for project', (done) => {
      helper.form('test1', [
        {
          type: 'textfield',
          key: 'firstName',
          label: 'First Name',
          input: true
        }
      ]).execute((err) => {
        if (err) {
          done(err);
        }

        const test1Form = helper.template.forms.test1;

        _.each(formDefaultsSetting, (value, key) => {
          assert.deepEqual(test1Form[key], value, `Form must have default setting ${key} equal to ${JSON.stringify(value)}`)
        })

        done();
      })
    });

    it('Default form settings should not override existing access settings set for access types', (done) => {
      const roles = helper.template.roles;
      const form2AccessSettings =  {
        access: [{
          roles: [
            roles.anonymous?._id,
          ],
          type: 'read_all'
        }],
        submissionAccess: [{
          roles: [
            roles.authenticated?._id,
          ],
          type: 'read_all'
        }],
      };

      helper.form(
        'test2',
        [
          {
            type: 'textfield',
            key: 'firstName',
            label: 'First Name',
            input: true
          }
        ],
        form2AccessSettings
      ).execute((err) => {
        if (err) {
          done(err);
        }
        const test2Form = helper.template.forms.test2;
        const access = test2Form.access;
        const submissionAccess = test2Form.submissionAccess;

        assert.deepEqual(access, form2AccessSettings.access, 'Access settings must be not everriden by formDefauls');
        assert.deepEqual(submissionAccess, [...form2AccessSettings.submissionAccess, ...formDefaultsSetting.submissionAccess], 'Submission Access settings must be not everriden by formDefauls');

        done();
      })
    });
  });

  if (!config.formio.hosted) {
    describe('Test sanitizeConfig Setting', function() {
      const helper = new Helper(template.formio.owner);
      const sanitizeConfig =  {
          addTags: ['iframe', 'script'],
      };
      const formOwnSanitizeConfig =  {
        addTags: ['link'],
      };

      before((done) => {
        helper.project().execute((err) => {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('Should save sanitizeConfig settings for the project', (done) => {
        request(app)
          .put('/project/' + helper.template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: { sanitizeConfig }})
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            assert.deepEqual(res.body.settings?.sanitizeConfig, sanitizeConfig);
            done();
          });
      });

      it('Should create a form ', (done) => {
        helper.form('test1', [
          {
            type: 'textfield',
            key: 'firstName',
            label: 'First Name',
            input: true
          }
        ]).execute((err) => {
          if (err) {
            done(err);
          }
          assert.equal(!!helper.getForm('test1'), true);
          done();
        })
      });

      it('Should attach globalSettings with sanitizeConfig to the form', (done) => {
        request(app)
          .get('/project/' + helper.template.project._id + '/form/' + helper.getForm('test1')._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .send()
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            assert.deepEqual(res.body.globalSettings?.sanitizeConfig, sanitizeConfig);
            done();
          });
      });

      it('Should add own sanitizeConfig to the form', (done) => {
        const form1 = helper.getForm('test1');

        _.set(form1, 'settings.sanitizeConfig', formOwnSanitizeConfig);
        helper.updateForm(form1, (err, updatedForm) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(updatedForm.settings?.sanitizeConfig, formOwnSanitizeConfig);
          done();
        })
      });

      it('Should not attach global sanitizeConfig to the form when the form has its own', (done) => {
        request(app)
          .get('/project/' + helper.template.project._id + '/form/' + helper.getForm('test1')._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .send()
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            assert.deepEqual(!!_.get(res.body, 'globalSettings.sanitizeConfig'), false);
            assert.deepEqual(res.body.settings?.sanitizeConfig, formOwnSanitizeConfig);
            done();
          });
      });
    });
  }
  // This is disabled until we set up customer testing again. This should not be allowed for hosted or docker version. Only customers.
  if (!docker || config.formio.hosted) {
    return;
  }
  describe('Separate Collections', function() {
    const helper = new Helper(template.formio.owner);
    const testApiKey = chance.string({ length: 30 });
    let collectionName = '';

    before((done) => {
      process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
      process.env.API_KEYS = testApiKey;

      helper.project({
        keys: [
          {
            name: chance.word(),
            key: testApiKey,
          },
        ]
      }).execute((err) => {
        if (err) {
          return done(err);
        }
        collectionName = `${helper.template.project.name}_testing`;

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
    });

    it('Should not allow you to configure the form to use separate collection', (done) => {
      helper.template.forms.collection.settings = {collection: 'testing'};
      request(app)
        .put(`/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`)
        .set('x-jwt-token', template.formio.owner.token)
        .send(helper.template.forms.collection)
        .expect(400)
        .expect('Only Enterprise projects can set different form collections.')
        .end(done);
    });

    it('Should upgrade the project to a Enterprise', function(done) {
      request(app)
        .put('/project/' + helper.template.project._id)
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
    // TODO: Find out why no indexes get created
    // it('Should have configured the mongo database collection', (done) => {
    //   // Give the db time to build indexes.
    //   setTimeout(() => {
    //     app.formio.formio.mongoose.model('submission').collection.indexInformation((err, subIndexes) => {
    //       setTimeout(()=>{
    //       app.formio.formio.mongoose.model(collectionName).collection.indexInformation((err, indexes) => {
    //         assert(indexes.hasOwnProperty('data.email_1'), 'No email index found');
    //         assert(indexes['data.email_1'][0][0], 'data.email');
    //         assert(indexes['data.email_1'][0][1], 1);
    //         assert(indexes.hasOwnProperty('data.lastName_1'), 'No last name index found');
    //         assert(indexes['data.lastName_1'][0][0], 'data.lastName');
    //         assert(indexes['data.lastName_1'][0][1], 1);
    //         done();
    //       });
    //     }, 300);
    //     });
    //   }, 300);
    // });

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

    it('Should get the submission with API key', (done) => {
      let subUrl = `/project/${  helper.template.project._id  }/form/${  helper.template.forms.collection._id}`;
      subUrl += `/submission/${  helper.template.submissions.collection[0]._id}`;
      request(app)
        .get(subUrl)
        .set('x-token', testApiKey)
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

    it('Should retrieve submissions for form with Select component with reference to a form with custom submissions collection', async () => {
      const textFieldComponent = {
        type: 'textfield',
        key: chance.word(),
        label: chance.word(),
        input: true
      };
      const textFieldComponentSubmission = { [textFieldComponent.key]: chance.word() };

      // Create resource with Text Field and assign custom submissions collection in settings
      const collectionName = chance.word();
      const resourceCreateRes = await request(app)
        .post(`/project/${helper.template.project._id}/form`)
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          title: chance.word(),
          name: chance.word(),
          path: chance.word(),
          type: 'resource',
          components: [textFieldComponent],
          settings: {
            collection: collectionName
          }
        });

      const createdResource = resourceCreateRes.body;

      assert.ok(createdResource._id);
      assert.equal(createdResource.project, helper.template.project._id);
      assert.equal(createdResource.components[0].key, textFieldComponent.key);
      assert.equal(createdResource.settings.collection, collectionName);

      // Create resource submission
      const resourceSubmissionCreateRes = await request(app)
        .post(`/project/${helper.template.project._id}/form/${createdResource._id}/submission`)
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          data: textFieldComponentSubmission
        });

      const resourceSubmission = resourceSubmissionCreateRes.body;

      assert.ok(resourceSubmission._id);
      assert.equal(resourceSubmission.form, createdResource._id);
      assert.deepEqual(resourceSubmission.data, textFieldComponentSubmission);

      // Set up Select component to use the created resource
      const selectComponent = {
        label: chance.word(),
        key: chance.word(),
        data: {
          resource: createdResource._id
        },
        reference: true,
        dataSrc: 'resource',
        template: `<span>{{ item.data.${textFieldComponent.key} }}</span>`,
        type: 'select',
        input: true
      };
      const selectComponentSubmission = { [selectComponent.key]: resourceSubmission };

      // Create form with Select component
      const formCreateRes = await request(app)
        .post(`/project/${helper.template.project._id}/form`)
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          title: chance.word(),
          name: chance.word(),
          path: chance.word(),
          type: 'form',
          components: [selectComponent]
        });

      const createdForm = formCreateRes.body;

      assert.ok(createdForm._id);
      assert.equal(createdForm.project, helper.template.project._id);
      assert.equal(createdForm.components[0].key, selectComponent.key);
      assert.equal(createdForm.components[0].data.resource, createdResource._id);

      // Create form submission
      const formSubmissionCreateRes = await request(app)
        .post(`/project/${helper.template.project._id}/form/${createdForm._id}/submission`)
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          data: selectComponentSubmission
        });

      const formSubmission = formSubmissionCreateRes.body;

      assert.ok(formSubmission._id);
      assert.equal(formSubmission.form, createdForm._id);
      assert.deepEqual(formSubmission.data, selectComponentSubmission);

      // Try to get form submissions
      const formSubmissionsRes = await request(app)
        .get(`/project/${helper.template.project._id}/form/${createdForm._id}/submission`)
        .set('x-jwt-token', template.formio.owner.token);

      const formSubmissions = formSubmissionsRes.body;

      assert.equal(formSubmissions.length, 1);
      assert.ok(formSubmissions[0].data.hasOwnProperty(selectComponent.key));

      const firstSubmissionData = _.omit(formSubmissions[0].data[selectComponent.key], ['deleted', 'externalTokens', '__v']);

      assert.deepEqual({ [selectComponent.key]: firstSubmissionData }, selectComponentSubmission);
    });
  });
};
