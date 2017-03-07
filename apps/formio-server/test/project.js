/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var Q = require('q');
var sinon = require('sinon');
var moment = require('moment');
var async = require('async');
var chance = new (require('chance'))();
var uuidRegex = /^([a-z]{15})$/;
var util = require('formio/src/util/util');
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;

module.exports = function(app, template, hook) {
  /**
   * Helper function to confirm the given properties are not present.
   */
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

  var confirmProjectPlan = function confirmProjectPlan(id, user, plan, next) {
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
          var response = res.body;
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

  describe('Projects', function() {
    var tempProject = {
      title: chance.word(),
      description: chance.sentence(),
      template: _.omit(template, ['users', 'formio'])
    };
    var originalProject = _.cloneDeep(tempProject);

    // Update the template with current data for future tests.
    var mapProjectToTemplate = function(project, template, callback) {
      var mapActions = function(forms, cb) {
        var form = null;
        for (var a = 0; a < forms.length || 0; a++) {
          form = forms[a];

          request(app)
            .get('/project/' + template.project._id + '/form/' + form._id + '/actions?limit=9999')
            .set('x-jwt-token', template.formio.owner.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return cb(err);

              // Update the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              res.body.forEach(function(action) {
                template.actions[form.name] = template.actions[form.name] || {};
                template.actions[form.name] = action;
              });
            });
        }

        cb();
      };

      var mapForms = function(cb) {
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
              template[form.type + 's'][form.name] = template[form.type + 's'][form.name] || {};
              template[form.type + 's'][form.name] = form;
            });
            mapActions(res.body, cb);
          });
      };

      var mapRoles = function(cb) {
        request(app)
          .get('/project/' + template.project._id + '/role?limit=9999')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return cb(err);

            // Update the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            res.body.forEach(function(role) {
              template.roles[role.title.toLowerCase()] = template.roles[role.title.toLowerCase()] || {};
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
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
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

          // Check plan and api calls info
          if (app.formio) {
            var plan = process.env.PROJECT_PLAN;
            assert.equal(response.plan, plan, 'The plan should match the default new project plan.');
            assert.deepEqual(response.apiCalls, {
              used: 0,
              remaining: app.formio.formio.plans.limits[response.plan],
              limit: app.formio.formio.plans.limits[response.plan],
              reset: moment().startOf('month').add(1, 'month').toISOString()
            });
          }

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted', 'primary']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          mapProjectToTemplate(response._id, template, done);
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

          var response = res.body;
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

          // Check plan and api calls info
          if (app.formio) {
            var plan = process.env.PROJECT_PLAN;
            assert.equal(response.plan, plan, 'The plan should match the default new project plan.');
            assert.deepEqual(response.apiCalls, {
              used: 0,
              remaining: app.formio.formio.plans.limits[response.plan],
              limit: app.formio.formio.plans.limits[response.plan],
              reset: moment().startOf('month').add(1, 'month').toISOString()
            });
          }

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted', 'primary', 'machineName']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A user without authentication should not be able to update a project.', function(done) {
      var newDescription = 'An updated Project Description.';
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
    //  var primary = app.formio && app.formio.formio && app.formio.formio.config && app.formio.formio.config.formioHost
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
      var newSettings = {
        cors: '*',
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
          gmail: {
            auth: {
              user: 'test@example.com',
              pass: 'test123'
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

          var response = res.body;
          assert.equal(response.hasOwnProperty('settings'), true);
          assert.deepEqual(response.settings, newSettings);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

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
          template.formio.owner.token = res.headers['x-jwt-token'];
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

          var response = res.body;
          var found = false;
          response.forEach(function(project) {
            if (project.name === template.project.name) {
              found = true;
            }
          });
          assert.equal(found, true);

          // Check plan and api calls info
          if (!docker && !customer) {
            var plan = process.env.PROJECT_PLAN;
            assert.equal(response[1].plan, plan, 'The plan should match the default new project plan.');
            assert.deepEqual(response[1].apiCalls, {
              used: 0,
              remaining: app.formio.formio.plans.limits[response[1].plan],
              limit: app.formio.formio.plans.limits[response[1].plan],
              reset: moment().startOf('month').add(1, 'month').toISOString()
            });
          }

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

          var response = res.text;
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

          var response = res.text;
          assert.equal(response, 'Unauthorized');

          done();
        });
    });

    it('An Anonymous User should not be able to Update a User-Created Project without permission', function(done) {
      var newDescription = 'An updated Project Description #2.';

      request(app)
        .put('/project/' + template.project._id)
        .send({description: newDescription})
        .expect(401)
        .expect('Content-Type', /text\/plain/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.text;
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

          var response = res.text;
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

          var response = res.text;
          assert.equal(response, 'Unauthorized');

          done();
        });
    });

    it('Updating a Project with duplicate permission types will condense the access permissions', function(done) {
      var newAccess = _.clone(template.project.access);
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

          var response = res.body;
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('access'), 'The response should contain an the `access`.');

          // Confirm that all permission types are present.
          assert.equal(response.access.length, 4);
          var permissions = _.map(response.access, 'type');
          assert.deepEqual(permissions, ['create_all', 'read_all', 'update_all', 'delete_all']);

          // Confirm that all roles are not empty.
          response.access.forEach(function(permission) {
            assert.notEqual(permission.roles, [], 'The ' + permission.type + ' role should not be empty.');
          });

          assert.notEqual(response.defaultAccess, [], 'The Projects default `role` should not be empty.');
          assert.equal(response.name, template.project.name);
          assert.equal(response.description, template.project.description);

          // Check that the response does not contain these properties.
          not(response, ['__v', 'deleted', 'settings_encrypted']);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('A Form.io User should be able to Delete their Project without explicit permissions', function(done) {
      request(app)
        .delete('/project/' + template.project._id)
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

    if (!docker)
    it('A Deleted Project should still remain in the Database', function(done) {
      app.formio.formio.resources.project.model.find({project: template.project._id, deleted: {$eq: null}})
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

    if (!docker)
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

    if (!docker)
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

          var response = res.body;
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

          mapProjectToTemplate(response._id, template, done);
        });
    });
  });

  describe('Project Plans', function() {
    describe('Basic Plan', function() {
      it('Confirm the project is on the basic plan', function(done) {
        confirmProjectPlan(template.project._id, template.formio.owner, 'basic', done);
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

            var response = res.body;
            assert.equal(response.hasOwnProperty('name'), true);
            assert.notEqual(response.name.search(uuidRegex), -1);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan should not be able to change the uuid generated name on project update', function(done) {
        var attempt = chance.word({length: 10});

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

            var response = res.body;
            assert.equal(response.hasOwnProperty('name'), true);
            assert.equal(response.name, template.project.name);
            assert.notEqual(response.name.search(uuidRegex), -1);

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set cors options on creation', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, '*');

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the basic plan will not be able to set cors options on project update', function(done) {
        var attempt = '*,www.example.com';

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

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, '*');

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('Independent Plan', function() {
      if (!docker)
      before(function(done) {
        // Confirm the dummy project is on the independent plan.
        app.formio.formio.resources.project.model.findOne({_id: template.project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) return done(err);

          project.plan = 'independent';
          project.save(function(err) {
            if (err) {
              return done(err);
            }

            done();
          });
        });
      });

      if (!docker)
      it('Confirm the project is on the independent plan', function(done) {
        confirmProjectPlan(template.project._id, template.formio.owner, 'independent', done);
      });

      it('A Project on the Independent plan will not be able to set cors options on creation', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, '*');

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('A Project on the Independent plan will not be able to set cors options on project update', function(done) {
        var attempt = '*,www.example.com';

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

            var response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.equal(response.settings.hasOwnProperty('cors'), true);
            assert.equal(response.settings.cors, '*');

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('CORS Access for default', function() {
      if (!docker)
      before(function(done) {
        // Confirm the dummy project is on the team plan.
        app.formio.formio.resources.project.model.findOne({_id: template.project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) return done(err);

          project.plan = 'team';
          project.save(function(err) {
            if (err) {
              return done(err);
            }

            done();
          });
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
            assert.equal(res.headers['access-control-allow-origin'], 'http://www.example.com');
            assert.equal(res.headers.hasOwnProperty('access-control-allow-methods'), false);
            done();
          });
      });
    });

    describe('CORS Access for project with CORS', function() {
      var cors = 'http://www.example.com,http://portal.example.com';

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

            var response = res.body;
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
            assert.equal(res.headers['access-control-allow-origin'], '*');
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
            assert.equal(res.headers['access-control-allow-origin'], 'http://www.example.com');
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
    });

    describe('Upgrading Plans', function() {
      if (!docker)
      before(function(done) {
        // Confirm the dummy project is on the basic plan.
        app.formio.formio.resources.project.model.findOne({_id: template.project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) return done(err);

          project.plan = 'basic';
          project.save(function(err) {
            if (err) {
              return done(err);
            }

            done();
          });
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
          .send({plan: '💩'})
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
          keyId: '123456',
          host: 'api.demo.globalgatewaye4.firstdata.com',
          endpoint: '/transaction/v19',
          gatewayId: 'AJ1234-01',
          gatewayPassword: '12345678901234567890123456789012',
          hmacKey: '12345678901234567890123456789012'
        };

        var paymentData = {
          ccNumber: '4111111111111111',
          ccExpiryMonth: '12',
          ccExpiryYear: '50',
          cardholderName: 'Elon Musk',
          securityCode: '123'
        };

        sinon.stub(util, 'request')
        .withArgs(sinon.match({
          method: 'POST',
          url: 'https://api.demo.globalgatewaye4.firstdata.com/transaction/v19',
          body: sinon.match({
            transaction_type: '01', // Pre-Authorization
            amount: 0,
            cardholder_name: paymentData.cardholderName,
            cc_number: '' + paymentData.ccNumber,
            cc_expiry: paymentData.ccExpiryMonth + paymentData.ccExpiryYear,
            cc_verification_str2: paymentData.securityCode,
            customer_ref: new Buffer(template.formio.owner._id.toString(), 'hex').toString('base64'),
            reference_3: template.formio.owner._id.toString(),
            user_name: template.formio.owner._id.toString(),
            client_email: template.formio.owner.data.email,
            currency_code: 'USD'
          })
        }))
        .returns(Q([{},
          {
            transaction_approved: 1,
            cardholder_name: paymentData.cardholderName,
            transarmor_token: '1234567899991111',
            cc_expiry: '1250',
            credit_card_type: 'visa',
            transaction_tag: '123456'
          }
        ]));

        request(app)
          .post('/payeezy')
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            data: paymentData
          })
          .expect('Content-Type', /text\/plain/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            Q(app.formio.formio.resources.form.model.findOne({name: 'paymentAuthorization'}))
            .then(function(form) {
              return app.formio.formio.resources.submission.model.findOne({form: form._id, owner: template.formio.owner._id});
            })
            .then(function(submission) {
              assert.equal(submission.data.ccNumber, '************1111', 'Only the last 4 digits of the cc number should be stored.');
              assert.equal(submission.data.ccExpiryMonth, '12', 'The expiration month should be stored.');
              assert.equal(submission.data.ccExpiryYear, '50', 'The expiration year should be stored.');
              assert.equal(submission.data.cardholderName, 'Elon Musk', 'The cardholder name should be stored.');
              assert(submission.data.transarmorToken.substr(-4) === '1111', 'The transarmor token should have the same last 4 digits as CC number.');
              assert(submission.data.hasOwnProperty('transactionTag'), 'The submission should store the transactionTag');
              assert.equal(submission.data.securityCode, undefined, 'The security card should not be stored.');

              util.request.restore();
              done();
            })
            .catch(function(err) {
              done(err);
            });
          });
      });

      if (!docker)
      it('Upgrading to independent with a registered payment method should work', function(done) {
        request(app)
          .post('/project/' + template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({plan: 'independent'})
          .expect('Content-Type', /text\/plain/)
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
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: template.formio.owner._id}).sort('-created');
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
          .expect('Content-Type', /text\/plain/)
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
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: template.formio.owner._id}).sort('-created');
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
          .expect('Content-Type', /text\/plain/)
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
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: template.formio.owner._id}).sort('-created');
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
          .expect('Content-Type', /text\/plain/)
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
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: template.formio.owner._id}).sort('-created');
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
          .expect('Content-Type', /text\/plain/)
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
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: template.formio.owner._id}).sort('-created');
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
          .expect('Content-Type', /text\/plain/)
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
                return app.formio.formio.resources.submission.model.find({form: form._id, owner: template.formio.owner._id}).sort('-created');
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
    });
  });
};
