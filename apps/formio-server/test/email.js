'use strict';
var request = require('supertest');
var assert = require('assert');
var async = require('async');
var chance = new (require('chance'))();
module.exports = function(app, template, hook) {
  if (process.env.DOCKER) {
    return;
  }

  describe('Emails', function() {
    var emailTest = require('./helper')(app, template, hook);
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
            from: 'no-reply@form.io',
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
        .execute(done);
    });

    it('Should send the separate emails with tokens', function(done) {
      template.hooks.onEmails(2, function(emails) {
        assert.equal(emails.length, 2);
        assert.equal(emails[0].from, 'travis@form.io');
        assert.equal(emails[0].to, 'joe@example.com');
        var matches = emails[0].html.match(/token=([^\s]+)/);
        assert.equal(matches.length, 2);
        user1Token = matches[1];
        assert.equal(emails[0].html.indexOf('This is amazing!, Your auth token is token='), 0);
        assert.equal(emails[0].subject, 'This is a dynamic email!');

        assert.equal(emails[1].from, 'travis@form.io');
        assert.equal(emails[1].to, 'john@example.com');
        matches = emails[1].html.match(/token=([^\s]+)/);
        assert.equal(matches.length, 2);
        user2Token = matches[1];
        assert.equal(emails[0].html.indexOf('This is amazing!, Your auth token is token='), 0);
        assert.equal(emails[0].subject, 'This is a dynamic email!');

        assert(user2Token != user1Token, 'Tokens must not match');
        done();
      });

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
      template.hooks.onEmails(1, function(emails) {
        var email = emails.shift();
        var parts = email.html.split('?x-jwt-token=');
        assert.equal(parts.length, 2);
        assert.equal(parts[0], 'http://localhost:9002/#/resetpass');
        resetToken = parts[1];
        assert(resetToken.length > 0, 'Reset token not provided');
        done();
      });

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
  });
};
