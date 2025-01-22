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
  var tempProject = {
    title: chance.word(),
    description: chance.sentence(),
    template: _.pick(template, ['title', 'name', 'version', 'primary', 'roles', 'resources', 'forms', 'actions']),
    type: 'project'
  };
  var originalProject = _.cloneDeep(tempProject);
  var project;

  describe('Domains tests', function() {
    it('Creates a project for testing', function(done) {
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
          assert.equal(response.title, tempProject.title);
          assert.equal(response.description, tempProject.description);

          project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Accesses default config by root', function(done) {
      request(app)
        .get('/')
        .set('host', 'form.io')
        //.set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;

          assert.equal(response.length, 1);
          assert.equal(response[0].name, 'formio');

          // Store the JWT for future API calls.
          //template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by subdomain', function(done) {
      request(app)
        .get('/')
        .set('host', project.name + '.form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    //it('Accesses current url', function(done) {
    //  request(app)
    //    .get('/current')
    //    .set('host', project.name + '.form.io')
    //    .set('x-jwt-token', template.formio.owner.token)
    //    .send()
    //    .expect('Content-Type', /json/)
    //    .expect(200)
    //    .end(function(err, res) {
    //      if (err) {
    //        return done(err);
    //      }
    //
    //      // Store the JWT for future API calls.
    //      template.formio.owner.token = res.headers['x-jwt-token'];
    //      done();
    //    });
    //});

    it('Accesses projects by subdomain on localhost', function(done) {
      request(app)
        .get('/')
        .set('host', project.name + '.localhost')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by subdomain on three part domain', function(done) {
      request(app)
        .get('/')
        .set('host', project.name + '.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by subdomain on four part domain', function(done) {
      request(app)
        .get('/')
        .set('host', project.name + '.www.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by subdomain on 127.0.0.1', function(done) {
      request(app)
        .get('/')
        .set('host', project.name + '.127.0.0.1')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by subdomain', function(done) {
      request(app)
        .get('/user/login')
        .set('host', project.name + '.form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by subdomain on a three part domain', function(done) {
      request(app)
        .get('/user/login')
        .set('host', project.name + '.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by subdomain on a four part domain', function(done) {
      request(app)
        .get('/user/login')
        .set('host', project.name + '.www.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by /project/:id', function(done) {
      request(app)
        .get('/project/' + project._id)
        .set('host', 'form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by /project/:id on three part domain', function(done) {
      request(app)
        .get('/project/' + project._id)
        .set('host', 'test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by /project/:id on four part domain', function(done) {
      request(app)
        .get('/project/' + project._id)
        .set('host', 'www.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by /project/:id', function(done) {
      request(app)
        .get('/project/' + project._id + '/user/login')
        .set('host', 'form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by /project/:id on three part domain', function(done) {
      request(app)
        .get('/project/' + project._id + '/user/login')
        .set('host', 'test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by /project/:id on four part domain', function(done) {
      request(app)
        .get('/project/' + project._id + '/user/login')
        .set('host', 'www.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by /:subdirectory', function(done) {
      request(app)
        .get('/' + project.name)
        .set('host', 'form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by /:subdirectory on three part domain', function(done) {
      request(app)
        .get('/' + project.name)
        .set('host', 'test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses projects by /:subdirectory on four part domain', function(done) {
      request(app)
        .get('/' + project.name)
        .set('host', 'www.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          // Don't check settings.
          delete response.settings;

          assert.deepEqual(_.omit(response, ['billing', 'apiCalls', 'modified', 'public', 'disabled']), _.omit(project, ['apiCalls', 'modified', 'public']));

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by /:subdirectory', function(done) {
      request(app)
        .get('/' + project.name + '/user/login')
        .set('host', 'form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by /:subdirectory on three part domain', function(done) {
      request(app)
        .get('/' + project.name + '/user/login')
        .set('host', 'test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses project form by /:subdirectory on four part domain', function(done) {
      request(app)
        .get('/' + project.name + '/user/login')
        .set('host', 'www.test.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses the api by root domain', function(done) {
      request(app)
        .post('/project/available')
        .set('host', 'form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send({ name: chance.word() })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.ok(response.available);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses the api subdomain by api subdomain', function(done) {
      request(app)
        .post('/project/available')
        .set('host', 'api.form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send({ name: chance.word() })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.ok(response.available);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses the api subdomain by project subdomain', function(done) {
      request(app)
        .post('/project/available')
        .set('host', project.name + '.form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send({ name: chance.word() })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.ok(response.available);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses the api subdomain by api on three part subdomain', function(done) {
      request(app)
        .post('/project/available')
        .set('host', 'asdfd.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send({ name: chance.word() })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.ok(response.available);

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses the formio project by subdomain', function(done) {
      request(app)
        .get('/user/login')
        .set('host', 'formio.form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Accesses the formio project by /:subdirectory', function(done) {
      request(app)
        .get('/formio/user/login')
        .set('host', 'form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Error when project not found by subdomain', function(done) {
      request(app)
        .get('/user/login')
        .set('host', 'bad.form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(404)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text, 'Not Found');
          done();
        });
    });

    it('Error when project not found in three part domain', function(done) {
      request(app)
        .get('/user/login')
        .set('host', 'form.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(404)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text, 'Not Found');
          done();
        });
    });

    it('Error when project not found in three part domain with subdomain', function(done) {
      request(app)
        .get('/user/login')
        .set('host', 'bad.form.co.uk')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(404)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text, 'Not Found');
          done();
        });
    });

    it('Error when project not found by /project/:projectId', function(done) {
      request(app)
        .get('/project/' + project._id + '1/user/login')
        .set('host', 'form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text, 'Invalid alias');
          done();
        });
    });

    it('Error when project not found by /project/:projectId or subdomain', function(done) {
      request(app)
        .get('/project/' + project._id + '1/user/login')
        .set('host', 'bad.form.io')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.text, 'Invalid alias');
          done();
        });
    });

    it('Accesses the server by ip address', function(done) {
      request(app)
        .get('/project/' + project._id + '/user/login')
        .set('host', '207.54.223.23')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.path, 'user/login');

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];
          done();
        });
    });
  });
};
