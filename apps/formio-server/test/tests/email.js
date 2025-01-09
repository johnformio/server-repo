'use strict';
var request = require('supertest');
var assert = require('assert');
var async = require('async');
var chance = new (require('chance'))();
let EventEmitter = require('events');
const defaultEmail = process.env.DEFAULT_EMAIL_SOURCE || 'no-reply@example.com';

module.exports = function(app, template, hook) {
  describe('Emails', function() {
    if (template.hooks.getEmitter() === null) {
      template.hooks.addEmitter(new EventEmitter());
    }

    var emailTest = new template.Helper(template.formio.owner);
    var user1Token = '';
    var user2Token = '';
    it('Bootstrap project and forms', function(done) {
      emailTest
        .project()
        .resource('user', [
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
            key: 'firstName',
            label: 'First Name',
            inputMask: '',
            inputType: 'text',
            input: true
          },
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
            key: 'lastName',
            label: 'Last Name',
            inputMask: '',
            inputType: 'text',
            input: true
          },
          {
            type: 'email',
            persistent: true,
            unique: false,
            protected: false,
            defaultValue: '',
            suffix: '',
            prefix: '',
            placeholder: 'Enter your email address',
            key: 'email',
            label: 'Email',
            inputType: 'email',
            tableView: true,
            input: true,
            validate: {
              custom: '',
              pattern: '',
              maxLength: '',
              minLength: '',
              required: false
            }
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
        ])
        .submission('user', {
          firstName: 'Joe',
          lastName: 'Smith',
          email: 'joe@example.com'
        })
        .submission('user', {
          firstName: 'John',
          lastName: 'Example',
          email: 'john@example.com'
        })
        .resource('customer', [
          {
            type: 'email',
            persistent: true,
            unique: false,
            protected: false,
            defaultValue: '',
            suffix: '',
            prefix: '',
            placeholder: 'Enter your email address',
            key: 'email',
            label: 'Email',
            inputType: 'email',
            tableView: true,
            input: true,
            validate: {
              custom: '',
              pattern: '',
              maxLength: '',
              minLength: '',
              required: false
            }
          }
        ])
        .action('customer', {
          title: 'Email',
          name: 'email',
          handler: ['after'],
          method: ['create'],
          priority: 1,
          settings: {
            transport: 'test',
            from: 'travis@form.io',
            emails: '{{ data.email }}',
            sendEach: true,
            subject: 'Inline Auth',
            message: 'Your auth token is token=[[token(data.email)]]'
          }
        })
        .form('resetpass', [
          {
            type: 'email',
            persistent: true,
            unique: false,
            protected: false,
            defaultValue: '',
            suffix: '',
            prefix: '',
            placeholder: 'Enter your email address',
            key: 'email',
            label: 'Email',
            inputType: 'email',
            tableView: true,
            input: true,
            validate: {
              custom: '',
              pattern: '',
              maxLength: '',
              minLength: '',
              required: true
            }
          },
          {
            type: 'password',
            suffix: '',
            prefix: '',
            placeholder: 'password',
            key: 'password',
            label: 'password',
            inputType: 'password',
            input: true,
            validate: {
              custom: '',
              pattern: '',
              maxLength: '',
              minLength: '',
              required: true
            }
          },
          {
            type: 'password',
            suffix: '',
            prefix: '',
            placeholder: 'verify password',
            key: 'verifyPassword',
            label: 'verify password',
            inputType: 'password',
            persistent: false,
            input: true,
            validate: {
              custom: "valid = (input == '{{ password }}') ? true : 'Passwords must match';",
              pattern: '',
              maxLength: '',
              minLength: '',
              required: true
            }
          }
        ], {
          submissionAccess: [
            {
              type: 'create_own',
              roles: ['anonymous']
            }
          ]
        })
        .action('resetpass', {
          title: 'Reset Password',
          handler: ['before', 'after'],
          method: ['form', 'create'],
          name: 'resetpass',
          priority: 0,
          settings: {
            resources: ['user'],
            from: defaultEmail,
            label: 'Send Reset Password',
            message: '{{ resetlink }}',
            password: 'password',
            subject: 'You requested a reset password',
            transport: 'test',
            url: 'http://localhost:9002/#/resetpass',
            username: 'email'
          }
        })
        .form('email', [
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
            placeholder: 'Enter an email subject',
            key: 'subject',
            label: 'Subject',
            inputMask: '',
            inputType: 'text',
            input: true
          },
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
            placeholder: 'Enter your message',
            key: 'message',
            label: 'message',
            inputMask: '',
            inputType: 'text',
            input: true
          },
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
            placeholder: 'Send to',
            key: 'sendTo',
            label: 'Send To:',
            inputMask: '',
            inputType: 'text',
            input: true
          }
        ])
        .action('email', {
          title: 'Email',
          name: 'email',
          handler: ['after'],
          method: ['create'],
          priority: 1,
          settings: {
            transport: 'test',
            from: 'travis@form.io',
            emails: '{{ data.sendTo }}',
            sendEach: true,
            subject: '{{ data.subject }}',
            message: '{{ data.message }}, Your auth token is token=[[token(data.email=user)]]'
          }
        })
        .form('pdfSubmissionTest', [
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
            placeholder: 'Enter a baseball player',
            key: 'player',
            label: 'Ball Player',
            inputMask: '',
            inputType: 'text',
            input: true
          },
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
            placeholder: 'Send to',
            key: 'sendTo',
            label: 'Send To:',
            inputMask: '',
            inputType: 'text',
            input: true
          }
        ])
        .action('pdfSubmissionTest', {
          title: 'Email',
          name: 'email',
          handler: ['after'],
          method: ['create'],
          priority: 1,
          settings: {
            transport: 'test',
            from: 'travis@form.io',
            emails: '{{ data.sendTo }}',
            sendEach: true,
            subject: 'Should send with no attachment if PDF submission fails',
            message: 'Hello, world!',
            attachPDF: true,
          }
        })
        .execute(done);
    });

    it('Should create an inline token with current submission', function(done) {
      let event = template.hooks.getEmitter();
      event.on('newMail', (email) => {
        assert.equal(email.from, 'travis@form.io');
        let matches = email.html.match(/token=([^\s]+)/);
        assert.equal(matches.length, 2);
        assert(matches[1] && matches[1].length > 20, 'An auth token was not created.');
        assert.equal(email.html.indexOf('Your auth token is token='), 0);
        event.removeAllListeners('newMail');
        done();
      })
      emailTest.createSubmission('customer', {
        email: 'test@example.com'
      }, function(err) {
        if (err) {
          return done(err);
        }
      });
    });

    it('Should send the separate emails with tokens', function(done) {
      let event = template.hooks.getEmitter();
      let email1 = new Promise((resolve, reject) => {
        event.on('newMail', (email) => {
          try {
            assert.equal(email.from, 'travis@form.io');
            assert.equal(email.to, 'joe@example.com');
            let matches = email.html.match(/token=([^\s]+)/);
            assert.equal(matches.length, 2);
            user1Token = matches[1];
            assert.equal(email.html.indexOf('This is amazing!, Your auth token is token='), 0);
            assert.equal(email.subject, 'This is a dynamic email!');
            return resolve();
          }
          catch (e) {}
        })
      });
      let email2 = new Promise((resolve, reject) => {
        event.on('newMail', (email) => {
          try {
            assert.equal(email.from, 'travis@form.io');
            assert.equal(email.to, 'john@example.com');
            let matches = email.html.match(/token=([^\s]+)/);
            assert.equal(matches.length, 2);
            user2Token = matches[1];
            assert.equal(email.html.indexOf('This is amazing!, Your auth token is token='), 0);
            assert.equal(email.subject, 'This is a dynamic email!');
            return resolve();
          }
          catch (e) {}
        });
      });

      Promise.all([email1, email2])
      .then(() => {
        event.removeAllListeners('newMail');
        assert(user2Token != user1Token, 'Tokens must not match');
        return done()
      })
      .catch(done);

      emailTest.createSubmission('email', {
        subject: 'This is a dynamic email!',
        message: 'This is amazing!',
        sendTo: 'joe@example.com, john@example.com'
      }, function(err) {
        if (err) {
          return done(err);
        }
      });
    });

    it('Should be able to authenticate using the first user token', function(done) {
      request(app)
        .get('/project/' + emailTest.template.project._id + '/current')
        .set('x-jwt-token', user1Token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.email, 'joe@example.com');
          assert.equal(res.body.data.firstName, 'Joe');
          assert.equal(res.body.data.lastName, 'Smith');
          done();
        });
    });

    it('Should be able to authenticate using the second user token', function(done) {
      request(app)
        .get('/project/' + emailTest.template.project._id + '/current')
        .set('x-jwt-token', user2Token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.email, 'john@example.com');
          assert.equal(res.body.data.firstName, 'John');
          assert.equal(res.body.data.lastName, 'Example');
          done();
        });
    });

    it('Should modify the form to only show the username field', function(done) {
      request(app)
        .get('/project/' + emailTest.template.project._id + '/resetpass?live=1')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Make sure the components are hidden or shown appropriately.
          assert.equal(res.body.components[0].key, 'email');
          assert.equal(res.body.components[0].type, 'email');
          assert.equal(res.body.components[0].validate.required, true);
          assert.equal(res.body.components[1].key, 'password');
          assert.equal(res.body.components[1].type, 'hidden');
          assert.equal(res.body.components[1].validate.required, false);
          assert.equal(res.body.components[2].key, 'verifyPassword');
          assert.equal(res.body.components[2].type, 'hidden');
          assert.equal(res.body.components[2].validate.required, false);
          done();
        });
    });

    it('Should fail if you reset password with bad email', function(done) {
      request(app)
        .post('/project/' + emailTest.template.project._id + '/resetpass/submission')
        .send({
          data: {
            'email': 'travis@form.io'
          }
        })
        .expect(400)
        .end(done);
    });

    var resetToken = '';
    it('Should allow you to reset the password', function(done) {
      let event = template.hooks.getEmitter();
      new Promise((resolve, reject) => {
        event.on('newMail', (email) => {
          try {
            var parts = email.html.split('?x-jwt-token=');
            assert.equal(parts.length, 2);
            assert.equal(parts[0], 'http://localhost:9002/#/resetpass');
            resetToken = parts[1];
            assert(resetToken.length > 0, 'Reset token not provided');
            return resolve();
          }
          catch (e) {
            return reject(e);
          }
        });
      })
      .then(() => done())
      .catch(done);

      request(app)
        .post('/project/' + emailTest.template.project._id + '/resetpass/submission')
        .send({
          data: {
            'email': 'joe@example.com'
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
        });
    });

    it('Should now only show the password fields of the form.', function(done) {
      request(app)
        .get('/project/' + emailTest.template.project._id + '/resetpass?live=1')
        .set('x-jwt-token', resetToken)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Make sure the components are hidden or shown appropriately.
          assert.equal(res.body.components[0].key, 'email');
          assert.equal(res.body.components[0].type, 'hidden');
          assert.equal(res.body.components[0].validate.required, false);
          assert.equal(res.body.components[1].key, 'password');
          assert.equal(res.body.components[1].type, 'password');
          assert.equal(res.body.components[1].validate.required, true);
          assert.equal(res.body.components[2].key, 'verifyPassword');
          assert.equal(res.body.components[2].type, 'password');
          assert.equal(res.body.components[2].validate.required, true);
          done();
        });
    });

    it('Should allow you to reset the password with the token provided', function(done) {
      request(app)
        .post('/project/' + emailTest.template.project._id + '/resetpass/submission')
        .set('x-jwt-token', resetToken)
        .send({
          data: {
            password: '123testing',
            verifyPassword: '123testing'
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.message, 'Password was successfully updated.');
          done();
        });
    });

    var userToken = '';
    it('Should allow that user to log in using their new password', function(done) {
      request(app)
        .post('/project/' + emailTest.template.project._id + '/user/login')
        .send({
          data: {
            email: 'joe@example.com',
            password: '123testing'
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.email, 'joe@example.com');
          userToken = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Should allow that user to view their current user using the token provided', function(done) {
      request(app)
        .get('/project/' + emailTest.template.project._id + '/current')
        .set('x-jwt-token', userToken)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.email, 'joe@example.com');
          done();
        });
    });

    it('Should silently fail to attach PDF if PDF server is not configured', function (done) {
      let event = template.hooks.getEmitter();

      event.on('newMail', (email) => {
        assert.equal(email.to, 'joe@example.com');
        // assert.equal(email.html.indexOf('This is amazing!, Your auth token is token='), 0);
        event.removeAllListeners('newMail');
        done();
      })

      emailTest.createSubmission('pdfSubmissionTest', {
        player: 'Sammy Sosa',
        sendTo: 'joe@example.com'
      }, function(err) {
        if (err) {
          return done(err);
        }
      });
    });

    it('Should send correct email for nested forms', (done) => {
      let testAction = {
        title: 'Email',
        name: 'email',
        handler: ['after'],
        method: ['create'],
        priority: 1,
        settings: {
          from: 'travis@form.io',
          replyTo: '',
          emails: ['test@form.io'],
          sendEach: false,
          subject: 'Hello',
          message: '{{ submission(data, form.components) }}',
          transport: 'test',
          template: 'https://pro.formview.io/assets/email.html',
          renderingMethod: 'dynamic'
        },
      }
      const childForm = {
        "_id": "677801142628e5aad5e7b1c2",
        "title": "9503 child",
        "name": "9503Child",
        "path": "9503child",
        "type": "form",
        "access": [],
        "submissionAccess": [],
        "components": [
          {
            "label": "Text Field",
            "applyMaskOn": "change",
            "tableView": true,
            "validateWhenHidden": false,
            "key": "textField",
            "type": "textfield",
            "input": true
          }
        ]
      }
      const parentForm = {
        "title": "9503 parent",
        "name": "9503Parent",
        "path": "9503parent",
        "type": "form",
        "access": [],
        "submissionAccess": [],
        "components": [
          {
            "label": "Form",
            "tableView": true,
            "form": "677801142628e5aad5e7b1c2",
            "useOriginalRevision": false,
            "key": "form",
            "type": "form",
            "input": true
          },
          {
            "type": "button",
            "label": "Submit",
            "key": "submit",
            "disableOnInvalid": true,
            "input": true,
            "tableView": false
          }
        ]
      }
      // Create child form
      request(app)
        .post(hook.alter('url', '/form', template))
        .set('x-jwt-token', template.users.admin.token)
        .send(childForm)
        .end((err, resChild) => {
          if (err) {
            return done(err);
          }
          parentForm.components[0].form = resChild.body._id;
          // Create parent form
          request(app)
            .post(hook.alter('url', '/form', template))
            .set('x-jwt-token', template.users.admin.token)
            .send(parentForm)
            .end((err, resParent) => {
              if (err) {
                return done(err);
              }
              testAction.form = resParent.body._id;
              // Add the action to the form.
              request(app)
                .post(hook.alter('url', `/form/${resParent.body._id}/action`, template))
                .set('x-jwt-token', template.users.admin.token)
                .send(testAction)
                .end((err, res) => {
                  if (err) {
                    return done(err);
                  }
                  testAction = res.body;
                  const event = template.hooks.getEmitter();
                  event.on('newMail', (email) => {
                    assert(email.html.includes('test'));
                    event.removeAllListeners('newMail');
                    done();
                  });
                  const submission = {
                    noValidate: true,
                    data: {
                      form: {
                        data: {
                          textField: 'test',
                        },
                        form: resChild.body._id,
                        _id: resParent.body._id
                      },
                      submit: true
                    },
                    state: 'submitted'
                  };
                  // Send submission
                  request(app)
                    .post(hook.alter('url', `/form/${resParent.body._id}/submission`, template))
                    .set('x-jwt-token', template.users.admin.token)
                    .send(submission)
                    .end((err, res) => {
                      if(err) {
                        return done(err);
                      }
                    });
                });
            });
        });
    });
  });
};
