/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var express = require('express');
var path = require('path');
var async = require('async');
var chance = new (require('chance'))();
var app = null;
var hook = null;
var template = _.cloneDeep(require('./tests/fixtures/template')());
var formioProject = require('../formio.json');
let EventEmitter = require('events');
const fetch = require('@formio/node-fetch-http-proxy');
const mockery = require('mockery');
const sinon = require('sinon');
const { Readable } = require('stream');
const mongoose = require('mongoose');
let formio;

function md5(str) {
  return require('crypto').createHash('md5').update(str).digest('hex');
}

function base64(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

  const eventEmitter = new EventEmitter();
  const testLogger = (err) => eventEmitter.emit('testException', err);

// Set up request mocking for license server.
const requestMock = sinon.stub()
  .withArgs(sinon.match({
    url: 'string',
    method: 'string',
    headers: 'object',
    qs: 'string',
    body: 'object',
    json: 'boolean',
    timeout: 'number',
  }))
  .callsFake(async (url, args) => {
    switch(url.split('?')[0]) {
      case 'https://license.form.io/utilization':
      case 'https://license.form.io/utilization/disable':
        let license;
        const argsBody = typeof args.body === 'string' ? JSON.parse(args.body) : args.body
        if (argsBody.licenseKey) {
          license = await formio.resources.submission.model.findOne({
            'data.licenseKeys.key': argsBody.licenseKey,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...JSON.parse(args.body),
            hash: md5(base64(JSON.parse(args.body))),
            used: {
              emails: 0,
              forms: 0,
              formRequests: 0,
              pdfs: 0,
              pdfDownloads: 0,
              submissionRequests: 0,
            },
            terms: license ? license.data : {
              plan: 'trial',
            },
            licenseId: 'abc123',
          }),
        });
      case 'https://api-cert.payeezy.com/v1/transactions':
        const body = JSON.parse(args.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            transaction_status: 'approved',
            transaction_type: 'authorize',
            method: 'credit_card',
            amount: 0,
            card: {
              ...body.credit_card,
            },
            transaction_tag: '123',
            validation_status: 'success',
            token: {
              token_type: 'FDToken',
              token_data: { value: body.credit_card.card_number }
            }
          }),
        });
      case 'https://github.com/login/oauth/access_token':
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: 'TESTACCESSTOKEN'
          }),
        });
      case 'https://api.github.com/user':
        return Promise.resolve({
          ok: true,
          json: async () => ({
            login: 'rahatarmanahmed',
            id: 123456,
            name: 'Rahat Ahmed',
            email: null
          }),
        });
      case 'https://api.github.com/user/emails':
        return Promise.resolve({
          ok: true,
          json: async () => ([{
            primary: true,
            verified: true,
            email: 'rahatarmanahmed@gmail.com'
          }]),
        });
      case 'https://graph.facebook.com/v2.3/oauth/access_token':
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: 'TESTACCESSTOKEN',
            expires_in: 86400
          }),
          headers: {
            get: () => {
              return new Date();
            },
          }
        });
      case 'https://graph.facebook.com/v2.3/me':
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 123456,
            name: 'Rahat Ahmed',
            email: 'rahatarmanahmed@gmail.com',
            first_name: 'Rahat',
            last_name: 'Ahmed',
          }),
        });
      case 'https://api.dropboxapi.com/1/oauth2/token':
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token:'accesstoken123'
          }),
        });
      case 'https://content.dropboxapi.com/2/files/download':
        return Promise.resolve({
          ok: true,
          body: {
            pipe: Readable.from(['RAWDATA'])
          },
          headers: {
            get: () => false,
          }
        });
      case 'https://content.dropboxapi.com/2/files/upload':
        return Promise.resolve({
          ok: true,
          json: async () => ({
            file: 'abc123',
          }),
        });
      case 'https://openIdProvider.com/userInfo.com':
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 123456,
            name: 'Rahat Ahmed',
            email: 'rahatarmanahmed@gmail.com',
            first_name: 'Rahat',
            last_name: 'Ahmed',
          }),
        });
      default:
        // Fallback to fetch.
        if (url.includes('localhost')) {
          return fetch(url, args);
        }
        // Don't allow external calls during testing.
        // console.log('Fetch call to', url);
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        });
    }
  });
mockery.registerMock('@formio/node-fetch-http-proxy', requestMock);

process.on('uncaughtException', function(err) {
  console.error(err);
});

process.on('unhandledRejection', (err) => {
  testLogger(err);
  console.error(err);
});

var emptyDatabase = template.emptyDatabase = template.clearData = function(done) {
  /**
   * Remove all documents using a mongoose model.
   *
   * @param model
   *   The mongoose model to delete.
   * @param next
   *   The callback to execute.
   */
  var dropDocuments = async function(model, next) {
    try {
      await model.deleteMany({});

      const count = await model.countDocuments({});
      assert.equal(count, 0);
      next();
    }
    catch (err) {
      return next(err);
    }
  };

  // Remove all test documents for tags.
  var dropTags = function(err) {
    if (err) {
      return done(err);
    }

    dropDocuments(app.formio.formio.resources.tag.model, done);
  };

  // Remove all test documents for roles.
  var dropRoles = function(err) {
    if (err) {
      return done(err);
    }

    dropDocuments(app.formio.formio.resources.role.model, dropTags);
  };

  // Remove all test documents for actions.
  var dropActions = function(err) {
    if (err) {
      return done(err);
    }

    dropDocuments(app.formio.formio.actions.model, dropRoles);
  };

  // Remove all test documents for submissions.
  var dropSubmissions = function(err) {
    if (err) {
      return done(err);
    }

    dropDocuments(app.formio.formio.resources.submission.model, dropActions);
  };

  // Remove all test documents for forms.
  var dropForms = function(err) {
    if (err) {
      return done(err);
    }

    dropDocuments(app.formio.formio.resources.form.model, dropSubmissions);
  };

  // Remove all test documents for Projects.
  var dropProjects = function() {
    dropDocuments(app.formio.formio.resources.project.model, dropForms);
  };

  // Clear out all test data, starting with Projects.
  dropProjects();
};

describe('Initial Tests', function() {
  before(function(done) {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false
    });
    var hooks = _.merge(require('formio/test/hooks'), require('./tests/hooks')); // Merge all the test hooks.
    require('../server')({
      hooks: hooks
    })
      .then(function(state) {
        app = state.app;

        app.use((err) => {
          testLogger(err);
        });

        formio = app.formio.formio;
        hook = require('formio/src/util/hook')(app.formio.formio);
        state.app.listen(state.config.port);

        // Establish the helper library.
        template.Helper = require('./tests/Helper')(app, require('formio/test/helper')(app));
        template.hooks = app.formio.formio.hooks || {};
        template.hooks.addEmitter(new EventEmitter());
        template.config = state.config;
        return done();
      });
  });

  /**
   * Create a simulated Form.io environment for testing.
   */
  describe('Bootstrap', function() {
    describe('Setup Form.io', function() {
      before(function(done) {
        process.env.ADMIN_KEY = 'examplekey';
        // Clear the database, reset the schema and perform a fresh install.
        emptyDatabase(done);
      });

      before('Drop the hosted usage collection if it exists', (done) => {
        // Drop the usage collection if it exists
        const db = app.formio.formio.mongoose.connection.db;
        db.listCollections({name: 'usage'}).hasNext()
          .then((result) => result ? db.collection('usage').drop() : Promise.resolve())
          .then((result) => done())
          .catch(done);
      })

      before('Create the hosted usage collection and the compound index', (done) => {
        const db = app.formio.formio.mongoose.connection.db;

        db.createCollection('usage', {timeseries: {timeField: 'timestamp', metaField: 'metadata'}})
          .catch((err) => {
            // we're presuming the error here is MongoDB API compatibility, so we'll try again with a normal collection for tests only
            console.log("Error while creating timeseries collection:", err);
            return db.createCollection('usage');
          })
          .then((collection) => {
            return collection.createIndex({ "metadata.project": 1, "timestamp": 1});
          })
          .then((result) => {
            done();
          })
      });

      formioProject.actions['userRegistrationForm:email'].settings.transport = 'test';

      it('Installs the form.io project', function(done) {
        request(app)
          .post('/project')
          .set('x-admin-key', process.env.ADMIN_KEY)
          .send({
            title: 'Form.io',
            name: 'formio',
            plan: 'commercial',
            template: formioProject,
            type: 'project'
          })
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            template.formio = {
              primary: res.body,
              project: res.body,
              owner: {
                data: {
                  name: chance.word(),
                  email: 'user@form.io',
                  password: chance.word({ length: 8 })
                }
              }
            };

            done();
          });
      });

      it('Discovers the formio project', function(done) {
        var getPrimary = function(cb) {
          request(app)
            .get('/')
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              response.forEach(function(project) {
                if (project.name === 'formio') {
                  template.formio.primary = project;
                }
              });

              cb();
            });
        };
        var getProject = function(cb) {
          request(app)
            .get('/project/' + template.formio.primary._id)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              template.formio.project = response;

              cb();
            });
        };
        var getForms = function(cb) {
          request(app)
            .get('/project/' + template.formio.project._id + '/form?limit=9999999')
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              response.forEach(function(form) {
                if (form.name === 'userRegistrationForm') {
                  template.formio.formRegister = form;
                }
                else if (form.name === 'userLoginForm') {
                  template.formio.formLogin = form;
                }
                else if (form.name === 'user') {
                  template.formio.userResource = form;
                }
                else if (form.name === 'admin') {
                  template.formio.adminResource = form;
                }
                else if (form.name === 'team') {
                  template.formio.teamResource = form;
                }
                else if (form.name === 'verifyAccount') {
                  template.formio.verifyForm = form;
                }
                else if (form.name == 'member') {
                  template.formio.memberResource = form;
                }
              });

              cb();
            });
        };
        var getRoles = function(cb) {
          request(app)
            .get('/project/' + template.formio.project._id + '/role?limit=1000')
            .set('x-admin-key', process.env.ADMIN_KEY)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return cb(err);
              }

              var response = res.body;
              template.formio.roles = {};
              response.forEach(function(role) {
                if (role.machineName === 'formio:administrator') {
                  template.formio.roles.administrator = role;
                }
                else if (role.machineName === 'formio:authenticated') {
                  template.formio.roles.authenticated = role;
                }
                else if (role.machineName === 'formio:anonymous') {
                  template.formio.roles.anonymous = role;
                }
              });

              cb();
            });
        };

        async.series([
          getPrimary,
          getProject,
          getForms,
          getRoles,
        ], function(err) {
          if (err) {
            return done(err);
          }

          done();
        });
      });

      it('A user can access the register form', function(done) {
        request(app)
          .get('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should be able to register a new user for Form.io', function(done) {
        const event = template.hooks.getEmitter();
        event.once('newMail', (email) => {
          var regex = /(?<=token=)[^"]+/i;
          var token = email.html.match(regex);
          token = token ? token[0] : token;

          template.formio.owner.token = token;

          done()
        });

        request(app)
          .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
          .send({
            data: {
              'name': template.formio.owner.data.name,
              'email': template.formio.owner.data.email,
            }
          })
          .expect(201)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
            assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert(response.data.hasOwnProperty('name'), 'The submission `data` should contain the `name`.');
            assert.equal(response.data.name, template.formio.owner.data.name);
            assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
            assert.equal(response.data.email, template.formio.owner.data.email);
            assert(!res.headers.hasOwnProperty('x-jwt-token'), 'The response shouldnt contain a `x-jwt-token` header.');

            var tempPassword = template.formio.owner.data.password;
            var tempToken = template.formio.owner.token;
            template.formio.owner = response;
            template.formio.owner.data.password = tempPassword;
            template.formio.owner.token = tempToken;
          });
      });

      it('A user can access the verify form', function(done) {
        request(app)
          .get('/project/' + template.formio.project._id + '/form/' + template.formio.verifyForm._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send()
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('User should be able to verify his email', function(done) {
        request(app)
          .put('/project/' + template.formio.project._id + '/form/' + template.formio.userResource._id + '/submission/' + template.formio.owner._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            data: {
              'name': template.formio.owner.data.name,
              'email': template.formio.owner.data.email,
              'password': template.formio.owner.data.password
            }
          })
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            var response = res.body;
            assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
            assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
            assert.equal(response.form, template.formio.userResource._id);
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response shouldnt contain a `x-jwt-token` header.');
              // Update our testProject.owners data.
            var tempPassword = template.formio.owner.data.password;
            template.formio.owner = response;
            template.formio.owner.data.password = tempPassword;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Make our test user the owner of formio', function(done) {
        request(app)
          .post('/project/' + template.formio.primary._id + '/owner')
          .set('x-admin-key', process.env.ADMIN_KEY)
          .send({
            owner: template.formio.owner._id
          })
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('Form.io owner should be able to login', function(done) {
        request(app)
          .post('/project/' + template.formio.project._id + '/form/' + template.formio.formLogin._id + '/submission')
          .send({
            data: {
              'email': template.formio.owner.data.email,
              'password': template.formio.owner.data.password
            }
          })
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
            assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
            assert(response.data.hasOwnProperty('name'), 'The submission `data` should contain the `name`.');
            assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
            assert.equal(response.data.email, template.formio.owner.data.email);
            assert(!response.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
            assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
            assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
            assert.equal(response.form, template.formio.userResource._id);
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

            // Update our testProject.owners data.
            var tempPassword = template.formio.owner.data.password;
            template.formio.owner = response;
            template.formio.owner.data.password = tempPassword;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      after(function(done) {
        delete process.env.ADMIN_KEY;
        done();
      })
    });

    after(function() {
      describe('Project Tests', function() {
        this.retries(4);
        require('./tests/usage')(app, template, hook);
        require('./tests/middleware')(app, template, hook);
        require('./tests/pdfProxy')(app, template, hook);
        require('./tests/teams')(app, template, hook);
        require('./tests/ssoTeams')(app, template, hook);
        require('./tests/sessions')(app, template, hook);
        require('./tests/project')(app, template, hook);
        require('./tests/env')(app, template, hook);
        require('./tests/tags')(app, template, hook);
        require('./tests/groups')(app, template, hook);
        require('./tests/domain')(app, template, hook);
        require('./tests/encrypt')(app, template, hook);
        require('./tests/email')(app, template, hook);
        require('./tests/states')(app, template, hook);
        require('formio/test/unit')(app, template, hook);
        require('formio/test/auth')(app, template, hook);
        require('./tests/externalTokens')(app, template, hook);
        require('formio/test/roles')(app, template, hook);
        require('formio/test/form')(app, template, hook);
        require('formio/test/resource')(app, template, hook);
        require('./tests/sacLicense')(app, template, hook);
        require('formio/test/nested')(app, template, hook);
        require('formio/test/actions')(app, template, hook);
        require('formio/test/submission')(app, template, hook);
        require('formio/test/submission-access')(app, template, hook);
        require('./tests/validate')(app, template, hook);
        require('./tests/misc')(app, template, hook);
        require('./tests/oauth')(app, template, hook, eventEmitter);
        require('./tests/googleDrive')(app, template, hook);
        require('./tests/s3')(app, template, hook);
        require('./tests/azure')(app, template, hook);
        require('./tests/dropbox')(app, template, hook);
        require('./tests/report')(app, template, hook);
        require('./tests/actions')(app, template, hook);
        require('./tests/pdfProxy')(app, template, hook);
        require('./tests/pdfUtils')(app, template, hook);
        require('./tests/revisions')(app, template, hook);
        require('./tests/esign')(app, template, hook);
        require('./tests/group-permissions')(app, template, hook);
        require('formio/test/templates')(app, template, hook);
        require('./tests/templates')(app, template, hook);
        require('./tests/updateSecret')(app, template, hook);
      });
    });
  });

  after((done) => {
    mockery.disable();
    done();
  })
});
