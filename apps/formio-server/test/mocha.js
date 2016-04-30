/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var Q = require('q');
var express = require('express');
var path = require('path');
var _formio = path.dirname(require.resolve('formio'));
var _test = path.join(_formio, 'test');
var async = require('async');
var chance = new (require('chance'))();
var docker = process.env.DOCKER;
var app = null;
var template = null;
var hook = require(path.join(_formio, 'src/util/hook'))({hooks: require('./hooks')});
var _server = null;
var ready;

process.on('uncaughtException', function(err) {
  console.log(err.stack);
});

if (!docker) {
  ready = require('./bootstrap')()
    .then(function(state) {
      _server = state.server;
      app = state.app;
      template = _.cloneDeep(state.template);
    });
}
else {
  app = 'http://api.localhost:3000';
  template = _.cloneDeep(require(path.join(_test, 'template'))());
  ready = Q();
}

/**
 * Create a simulated Form.io environment for testing.
 */
describe('Bootstrap', function() {
  describe('Recreate Formio', function() {
    before(function() {
      return ready;
    });

    it('Attach Formio properties', function(done) {
      template.formio = {
        owner: {
          data: {
            name: chance.word(),
            email: chance.email(),
            password: 'test123'
          }
        },
        project: {
          _id: '553db92f72f702e714dd9778'
        },
        formRegister: {
          _id: '553dbedd3c605f841af5b3a7'
        },
        formLogin: {
          _id: '553dbe603c605f841af5b3a5'
        },
        formTeam: {
          _id: '55479ce7685637ab440a0765'
        },
        userResource: {
          _id: '553db94e72f702e714dd9779'
        }
      };
      done();
    });

    it('Should remove old test data', function(done) {
      if (docker) return done();

      /**
       * Remove all documents using a mongoose model.
       *
       * @param model
       *   The mongoose model to delete.
       * @param next
       *   The callback to execute.
       */
      var dropDocuments = function(model, next) {
        model.remove({}, function(err) {
          if (err) {
            return next(err);
          }

          next();
        });
      };

      // Remove all test documents for roles.
      var dropRoles = function() {
        dropDocuments(app.formio.resources.role.model, done);
      };

      // Remove all test documents for actions.
      var dropActions = function() {
        dropDocuments(app.formio.actions.model, dropRoles);
      };

      // Remove all test documents for submissions.
      var dropSubmissions = function() {
        dropDocuments(app.formio.resources.submission.model, dropActions);
      };

      // Remove all test documents for forms.
      var dropForms = function() {
        dropDocuments(app.formio.resources.form.model, dropSubmissions);
      };

      // Remove all test documents for Projects.
      var dropProjects = function() {
        dropDocuments(app.formio.resources.project.model, dropForms);
      };

      // Clear out all test data, starting with Projects.
      dropProjects();
    });

    it('Should be able to bootstrap Form.io', function(done) {
      if (docker) return done();

      /**
       * Store a document using a mongoose model.
       *
       * @param model
       *   The mongoose model to use for document storage.
       * @param document
       *   The document to store in Mongo.
       * @param next
       *   The callback to execute.
       */
      var storeDocument = function(model, document, next) {
        model.create(template.formio[document], function(err, result) {
          if (err) {
            return next(err);
          }

          template.formio[document] = result;
          next();
        });
      };

      var createProject = function(then) {
        template.formio.project = {
          title: 'Form.io Test',
          name: 'formio',
          description: 'This is a test version of formio.',
          primary: true,
          settings: {
            cors: '*'
          }
        };

        storeDocument(app.formio.resources.project.model, 'project', then);
      };
      var createRoleAdministrator = function(then) {
        template.formio.roleAdministrator = {
          title: 'Administrator',
          description: 'A role for Administrative Users.',
          project: template.formio.project._id,
          default: false,
          admin: true
        };

        storeDocument(app.formio.resources.role.model, 'roleAdministrator', then);
      };
      var createRoleAuthenticated = function(then) {
        template.formio.roleAuthenticated = {
          title: 'Authenticated',
          description: 'A role for Authenticated Users.',
          project: template.formio.project._id,
          default: false,
          admin: false
        };

        storeDocument(app.formio.resources.role.model, 'roleAuthenticated', then);
      };
      var createRoleAnonymous = function(then) {
        template.formio.roleAnonymous = {
          title: 'Anonymous',
          description: 'A role for Anonymous Users.',
          project: template.formio.project._id,
          default: true,
          admin: false
        };

        storeDocument(app.formio.resources.role.model, 'roleAnonymous', then);
      };
      var setDefaultProjectAccess = function(then) {
        app.formio.resources.project.model.findById(template.formio.project._id, function(err, document) {
          if (err) { return then(err); }

          // Update the default role for this Project.
          document.defaultAccess = template.formio.roleAnonymous._id;
          document.access = [{type: 'read_all', roles: [template.formio.roleAnonymous._id]}];

          // Save the changes to the Form.io Project and continue.
          document.save(function(err) {
            if (err) {
              return then(err);
            }

            // No error occurred, document the changes.
            template.formio.project.defaultAccess = template.formio.roleAnonymous._id;

            // Call next callback.
            then();
          });
        });

      };
      var createPaymentForm = function(then) {
        template.formio.formPayment = {
          title: 'Payment Authorization',
          type: 'form',
          name: 'paymentAuthorization',
          path: 'payment',
          project: template.formio.project._id,
          components : [] // We don't need components to test the form
        };

        storeDocument(app.formio.resources.form.model, 'formPayment', then);
      };
      var createUpgradeHistoryForm = function(then) {
        template.formio.formPayment = {
          title: 'Project Upgrade History Form',
          type: 'form',
          name: 'projectUpgradeHistory',
          path: 'projectUpgradeHistory',
          project: template.formio.project._id,
          components : [] // We don't need components to test the form
        };

        storeDocument(app.formio.resources.form.model, 'formPayment', then);
      };
      var createUserResource = function(then) {
        template.formio.userResource = {
          title: 'Users',
          name: 'user',
          path: 'user',
          type: 'resource',
          project: template.formio.project._id,
          access: [],
          submissionAccess: [
            {type: 'read_own', roles: [template.formio.roleAuthenticated._id]},
            {type: 'update_own', roles: [template.formio.roleAuthenticated._id]},
            {type: 'delete_own', roles: [template.formio.roleAuthenticated._id]}
          ],
          components: [
            {
              type: 'email',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: true
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'email',
              key: 'email',
              label: 'email',
              inputMask: '',
              inputType: 'email',
              input: true
            },
            {
              type: 'textfield',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: true
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'name',
              key: 'name',
              label: 'name',
              inputMask: '',
              inputType: 'text',
              input: true
            },
            {
              type: 'password',
              suffix: '',
              prefix: '',
              placeholder: 'password',
              key: 'password',
              label: 'password',
              inputType: 'password',
              input: true
            }
          ]
        };

        storeDocument(app.formio.resources.form.model, 'userResource', then);
      };
      var createTeamResource = function(then) {
        template.formio.teamResource = {
          title: 'Team',
          type: 'resource',
          name: 'team',
          path: 'team',
          project: template.formio.project._id,
          access: [
            {type: 'read_all', roles: [template.formio.roleAuthenticated._id]}
          ],
          submissionAccess: [
            {type: 'create_own', roles: [template.formio.roleAuthenticated._id]},
            {type: 'read_own', roles: [template.formio.roleAuthenticated._id]},
            {type: 'update_own', roles: [template.formio.roleAuthenticated._id]},
            {type: 'delete_own', roles: [template.formio.roleAuthenticated._id]}
          ],
          components: [
            {
              lockKey: true,
              type: 'textfield',
              validate: {
                customPrivate: false,
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: false
              },
              persistent: true,
              unique: false,
              protected: false,
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'Enter the name for this team',
              key: 'name',
              label: 'Team Name',
              inputMask: '',
              inputType: 'text',
              input: true
            },
            {
              type: 'resource',
              refreshDelay: 0,
              refresh: false,
              multiple: true,
              searchFields: '',
              searchExpression: '',
              template: '<span>{{ item.data.name }}</span>',
              resource: template.formio.userResource._id,
              placeholder: 'Select the members on this team.',
              key: 'members',
              label: 'Members',
              input: true
            },
            {
              theme: 'primary',
              disableOnInvalid: true,
              action: 'submit',
              block: false,
              rightIcon: '',
              leftIcon: '',
              size: 'md',
              key: 'submit',
              label: 'Submit',
              input: true,
              type: 'button'
            }
          ]
        };

        storeDocument(app.formio.resources.form.model, 'teamResource', then);
      };
      var createLoginForm = function(then) {
        template.formio.formLogin = {
          title: 'User Login',
          name: 'login',
          path: 'user/login',
          type: 'form',
          project: template.formio.project._id,
          access: [
            {type: 'read_all', roles: [template.formio.roleAnonymous._id]}
          ],
          submissionAccess: [
            {type: 'create_own', roles: [template.formio.roleAnonymous._id]}
          ],
          components: [
            {
              type: 'email',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: true
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'email',
              key: 'email',
              label: 'email',
              inputMask: '',
              inputType: 'email',
              input: true
            },
            {
              type: 'password',
              suffix: '',
              prefix: '',
              placeholder: 'password',
              key: 'password',
              label: 'password',
              inputType: 'password',
              input: true
            },
            {
              theme: 'primary',
              disableOnInvalid: true,
              action: 'submit',
              block: false,
              rightIcon: '',
              leftIcon: '',
              size: 'md',
              key: 'submit',
              label: 'Submit',
              input: true,
              type: 'button'
            }
          ]
        };

        storeDocument(app.formio.resources.form.model, 'formLogin', then);
      };
      var createRegisterForm = function(then) {
        template.formio.formRegister = {
          title: 'User Register',
          name: 'register',
          path: 'user/register',
          type: 'form',
          project: template.formio.project._id,
          access: [
            {type: 'read_all', roles: [template.formio.roleAnonymous._id]}
          ],
          submissionAccess: [
            {type: 'create_own', roles: [template.formio.roleAnonymous._id]}
          ],
          components: [
            {
              type: 'email',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: true
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'email',
              key: 'email',
              label: 'email',
              inputMask: '',
              inputType: 'email',
              input: true
            },
            {
              type: 'textfield',
              validate: {
                custom: '',
                pattern: '',
                maxLength: '',
                minLength: '',
                required: true
              },
              defaultValue: '',
              multiple: false,
              suffix: '',
              prefix: '',
              placeholder: 'name',
              key: 'name',
              label: 'name',
              inputMask: '',
              inputType: 'text',
              input: true
            },
            {
              type: 'password',
              suffix: '',
              prefix: '',
              placeholder: 'password',
              key: 'password',
              label: 'password',
              inputType: 'password',
              input: true
            },
            {
              theme: 'primary',
              disableOnInvalid: true,
              action: 'submit',
              block: false,
              rightIcon: '',
              leftIcon: '',
              size: 'md',
              key: 'submit',
              label: 'Submit',
              input: true,
              type: 'button'
            }
          ]
        };

        storeDocument(app.formio.resources.form.model, 'formRegister', then);
      };

      var createActionSave = function(then) {
        template.formio.actionUserSave = {
          name: 'save',
          title: 'Save Submission',
          form: template.formio.userResource._id,
          priority: 10,
          method: ['create', 'update'],
          handler: ['before'],
          settings: {}
        };

        // Create an email template.
        template.formio.actionUserEmail = {
          name: 'email',
          title: 'Email',
          form: template.formio.userResource._id,
          priority: 0,
          method: ['create'],
          handler: ['after'],
          settings: {
            transport: 'test',
            from: 'no-reply@form.io',
            emails: '{{ data.email }}',
            subject: 'New user {{ _id }} created',
            message: 'Email: {{ data.email }}, token=[[token(data.email=user,admin)]]'
          }
        };

        // Create a register action for this form.
        template.formio.actionTeamSave = {
          name: 'save',
          title: 'Save Submission',
          form: template.formio.teamResource._id,
          priority: 10,
          method: ['create', 'update'],
          handler: ['before'],
          settings: {}
        };

        async.series([
          async.apply(storeDocument, app.formio.actions.model, 'actionUserSave'),
          async.apply(storeDocument, app.formio.actions.model, 'actionUserEmail'),
          async.apply(storeDocument, app.formio.actions.model, 'actionTeamSave')
        ], then);
      };

      var createActionLogin = function(then) {
        template.formio.actionLogin = {
          name: 'login',
          title: 'Login',
          form: template.formio.formLogin._id,
          priority: 2,
          method: ['create'],
          handler: ['before'],
          settings: {
            resources: [template.formio.userResource._id],
            username: 'email',
            password: 'password'
          }
        };

        async.series([
          async.apply(storeDocument, app.formio.actions.model, 'actionLogin')
        ], then);
      };
      var createActionRegister = function(then) {

        // Create a register action for this form.
        template.formio.actionUserRole = {
          title: 'Role Assignment',
          name: 'role',
          form: template.formio.userResource._id,
          priority: 1,
          handler: ['after'],
          method: ['create'],
          settings: {
            association: 'new',
            type: 'add',
            role: template.formio.roleAuthenticated._id.toString()
          }
        };

        // Create a register action for this form.
        template.formio.actionRegisterSave = {
          name: 'save',
          title: 'Save Submission',
          form: template.formio.formRegister._id,
          priority: 11,
          method: ['create', 'update'],
          handler: ['before'],
          settings: {
            resource: template.formio.userResource._id.toString(),
            fields: {
              name: 'name',
              email: 'email',
              password: 'password'
            }
          }
        };

        template.formio.actionRegisterLogin = {
          name: 'login',
          title: 'Login',
          form: template.formio.formRegister._id,
          priority: 2,
          method: ['create'],
          handler: ['before'],
          settings: {
            resources: [template.formio.userResource._id],
            username: 'email',
            password: 'password'
          }
        };

        async.series([
          async.apply(storeDocument, app.formio.actions.model, 'actionUserRole'),
          async.apply(storeDocument, app.formio.actions.model, 'actionRegisterSave'),
          async.apply(storeDocument, app.formio.actions.model, 'actionRegisterLogin')
        ], then);
      };

      // Create the project.
      async.series([
        async.apply(createProject),
        async.apply(createRoleAdministrator),
        async.apply(createRoleAuthenticated),
        async.apply(createRoleAnonymous),
        async.apply(setDefaultProjectAccess),
        async.apply(createPaymentForm),
        async.apply(createUpgradeHistoryForm),
        async.apply(createUserResource),
        async.apply(createTeamResource),
        async.apply(createLoginForm),
        async.apply(createRegisterForm),
        async.apply(createActionSave),
        async.apply(createActionLogin),
        async.apply(createActionRegister)
      ], done);
    });
  });

  describe('Initial access tests', function() {
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
      request(app)
        .post('/project/' + template.formio.project._id + '/form/' + template.formio.formRegister._id + '/submission')
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
          assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
          assert(response.hasOwnProperty('modified'), 'The response should contain a `modified` timestamp.');
          assert(response.hasOwnProperty('created'), 'The response should contain a `created` timestamp.');
          assert(response.hasOwnProperty('data'), 'The response should contain a submission `data` object.');
          assert(response.data.hasOwnProperty('name'), 'The submission `data` should contain the `name`.');
          assert.equal(response.data.name, template.formio.owner.data.name);
          assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
          assert.equal(response.data.email, template.formio.owner.data.email);
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

    if (!docker) {
      it('Should have sent an email to the user with a valid auth token', function(done) {
        var email = template.hooks.getLastEmail();
        assert.equal(email.from, 'no-reply@form.io');
        assert.equal(email.to, template.formio.owner.data.email);
        assert.equal(email.subject, 'New user ' + template.formio.owner._id.toString() + ' created');

        // Get the token.
        var matches = email.html.match(/token=([^\s]+)/);
        assert.equal(matches.length, 2);
        var token = matches[1];

        // This user should be able to authenticate using this token.
        request(app)
          .get('/project/' + template.formio.project._id + '/current')
          .set('x-jwt-token', token)
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
            assert(response.data.hasOwnProperty('email'), 'The submission `data` should contain the `email`.');
            assert.equal(response.data.email, template.formio.owner.data.email);
            assert(!response.data.hasOwnProperty('password'), 'The submission `data` should not contain the `password`.');
            assert(response.hasOwnProperty('form'), 'The response should contain the resource `form`.');
            assert.equal(response.form, template.formio.userResource._id);
            assert(res.headers.hasOwnProperty('x-jwt-token'), 'The response should contain a `x-jwt-token` header.');

            // Update our template.users.admins data.
            var tempPassword = template.formio.owner.data.password;
            template.formio.owner = response;
            template.formio.owner.data.password = tempPassword;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    }

    it('A Form.io User should be able to login', function(done) {
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
          assert.equal(response.data.name, template.formio.owner.data.name);
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
  });

  after(function() {
    describe('Final Tests', function() {
      describe('Formio-Server', function() {
        require('./project')(app, template, hook);
        require('./websockets')(app, template, hook);
      });

      var originalSettingsHook;
      describe('Formio', function() {
        before(function() {
          if (!app.formio) return;
          // Override settings hook for formio tests
          originalSettingsHook = app.formio.hooks.settings;
          app.formio.hooks.settings = require('./formioHooks.js')(_test).settings;
        });

        // Set up formio specific hooks
        var formioHook = require(path.join(_formio, 'src/util/hook'))({hooks: require('./formioHooks.js')(_test)});

        require(path.join(_test, 'unit'))(app, template, formioHook);
        require(path.join(_test, 'auth'))(app, template, formioHook);
        require(path.join(_test, 'roles'))(app, template, formioHook);
        require(path.join(_test, 'form'))(app, template, formioHook);
        require(path.join(_test, 'resource'))(app, template, formioHook);
        require(path.join(_test, 'nested'))(app, template, formioHook);
        require(path.join(_test, 'actions'))(app, template, formioHook);
        require(path.join(_test, 'submission'))(app, template, formioHook);
        require('./analytics')(app, template, formioHook);
        require('./teams')(app, template, formioHook);
      });

      describe('Formio-Server tests that depend on Formio tests', function() {
        before(function() {
          if (!app.formio) return;
          // Restore settings hook
          app.formio.hooks.settings = originalSettingsHook;
        });
        require('./misc')(app, template, hook);
        require('./oauth')(app, template, hook);
        require('./s3')(app, template, hook);
        require('./report')(app, template, hook);
      });
    });
  });
});
