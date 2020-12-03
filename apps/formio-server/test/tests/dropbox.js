/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');

module.exports = function(app, template, hook) {
  if (process.env.DOCKER) {
    return;
  }
  process.env.DROPBOX_CLIENTID = 'NOT_REAL';

  describe('Dropbox setup', function() {
    var testUser = {
      email: 'dropboxUser@example.com',
      password: 'password'
    }

    it('Updates the project settings with dropbox information', function(done) {
      var newSettings = {
        cors: '*',
        storage: {
          dropbox: {
            access_token: 'abcdefghijklmnop',
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
          assert.deepEqual(_.omit(response.settings, ['licenseKey']), newSettings);

          template.project = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Registers an authenticated user', function(done)  {
      request(app)
        .post('/project/' + template.project._id + '/form/' + template.forms.userRegister._id + '/submission')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          data: {
            'email': testUser.email,
            'password': testUser.password
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;

          template.users.tempUser = response;
          template.users.tempUser.data.password = testUser.password;

          // Store the JWT for future API calls.
          template.users.tempUser.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Creates an upload form', function(done) {
      var uploadForm = {
        title: 'Upload Form',
        name: 'uploadForm',
        path: 'uploadfile',
        type: 'form',
        access: [],
        submissionAccess: [
          {
            type: 'read_all',
            roles: [
              template.roles.administrator._id.toString(),
              template.roles.authenticated._id.toString()
            ]
          },
          {
            type: 'create_own',
            roles: [
              template.roles.administrator._id.toString(),
              template.roles.authenticated._id.toString()
            ]
          },
          {
            type: 'update_own',
            roles: [
              template.roles.administrator._id.toString(),
              template.roles.authenticated._id.toString()
            ]
          }
        ],
        components: [
          {
            type: 'file',
            multiple: true,
            key: 'file',
            label: 'File Upload',
            input: true,
            storage: 'dropbox',
            dir: 'dir/'
          }
        ]
      };

      request(app)
        .post('/project/' + template.project._id + '/form')
        .set('x-jwt-token', template.formio.owner.token)
        .send(uploadForm)
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
          assert.equal(response.title, uploadForm.title);
          assert.equal(response.name, uploadForm.name);
          assert.equal(response.path, uploadForm.path);
          assert.equal(response.type, 'form');
          assert.notEqual(response.access, []);
          assert.equal(response.access.length, 1);
          assert.equal(response.access[0].type, 'read_all');
          assert.equal(response.access[0].roles.length, 3);
          assert.deepEqual(response.components, uploadForm.components);
          template.forms.uploadForm = response;

          // Store the JWT for future API calls.
          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

  });

  describe('Dropbox', function() {
    it('Denies access to GET dropbox auth token endpoint for anonymous', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/dropbox/auth')
        .send()
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Denies access to GET dropbox auth token endpoint for authenticated', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/dropbox/auth')
        .set('x-jwt-token', template.users.tempUser.token)
        .send()
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Allows access to GET dropbox auth token endpoint for project owner', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/dropbox/auth')
        .set('x-jwt-token', template.formio.owner.token)
        .send()
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.body.response_type, 'code');
          assert.equal(res.body.client_id, process.env.DROPBOX_CLIENTID);
          assert.equal(res.body.state.length, 128);

          template.formio.owner.token = res.headers['x-jwt-token'];

          done();
        });
    });

    it('Denies access to POST dropbox auth token endpoint for anonymous', function(done) {
      request(app)
        .post('/project/' + template.project._id + '/dropbox/auth')
        .send({})
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Denies access to POST dropbox auth token endpoint for authenticated', function(done) {
      request(app)
        .post('/project/' + template.project._id + '/dropbox/auth')
        .set('x-jwt-token', template.users.tempUser.token)
        .send({})
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Sends an auth code to dropbox and saves the access_token', function(done) {
      request(app)
        .post('/project/' + template.project._id + '/dropbox/auth')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          code: 'abc123',
          redirect_uri: 'http://localhost:3000'
        })
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.body.access_token, 'accesstoken123');
          done();
        });
    });

    it('Denies access to download a dropbox file for anonymous', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/dropbox?path_lower=abc123')
        .send()
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    // it('Allows access to download a dropbox file for authenticated', function(done) {
    //   request(app)
    //     .get('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/dropbox?path_lower=abc123&x-jwt-token=' + encodeURIComponent(template.users.tempUser.token))
    //     .send()
    //     .expect(200)
    //     .end(function(err, res) {
    //       if (err) {
    //         return done(err);
    //       }
    //       assert.equal(res.text, 'RAWDATA');
    //       assert.equal(res.headers['content-disposition'], 'filename=abc123');
    //       done();
    //     });
    // });

    it('Denies access to upload a dropbox file for anonymous', function(done) {
      request(app)
        .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/dropbox')
        .send()
        .expect(401)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    // it('Allows access to upload a dropbox file for authenticated', function(done) {
    //   const file = new Buffer.from([0x62,0x75,0x66,0x66,0x65,0x72]);
    //   request(app)
    //     .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/dropbox')
    //     .set('x-jwt-token', template.users.tempUser.token)
    //     .field('name', 'abc123')
    //     .field('dir', '')
    //     .attach('file', file, 'test.txt')
    //     .expect(200)
    //     .end(function(err, res) {
    //       if (err) {
    //         return done(err);
    //       }
    //       assert.equal(res.body.file, 'abc123');
    //       done();
    //     });
    // });

    // The following test will crash the server as the array is too big.
    //it('Restricts access to upload a dropbox file larger than 150M', function(done) {
    //  const file = new Buffer(new Array(157286400).fill(0x62));
    //  request(app)
    //    .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/dropbox')
    //    .set('x-jwt-token', template.users.tempUser.token)
    //    .field('name', 'abc123')
    //    .field('dir', '')
    //    .attach('file', file, 'test.txt')
    //    .expect(413)
    //    .end(function(err, res) {
    //      if (err) {
    //        return done(err);
    //      }
    //      done();
    //    });
    //});

    it('Clears the dropbox access_token', function(done) {
      request(app)
        .post('/project/' + template.project._id + '/dropbox/auth')
        .set('x-jwt-token', template.formio.owner.token)
        .send({})
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(typeof res.body.access_token, 'undefined');
          done();
        });
    });

  });

  describe('Dropbox teardown', function() {

    it('Deletes the upload form', function(done) {
      request(app)
        .delete('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var response = res.body;
          assert.deepEqual(response, {});

          template.formio.owner.token = res.headers['x-jwt-token'];

          delete template.forms.uploadForm;

          done();
        });
    });

    it('Deletes the temp user', function(done) {
      request(app)
        .delete('/project/' + template.project._id + '/form/' + template.resources.user._id + '/submission/' + template.users.tempUser._id)
        .set('x-jwt-token', template.formio.owner.token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var response = res.body;
          assert.deepEqual(response, {});

          delete template.users.tempUser;

          done();
        });
    });
  });
}
