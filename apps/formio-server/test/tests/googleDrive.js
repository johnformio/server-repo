/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const docker = process.env.DOCKER;
const _ = require('lodash');

module.exports = function(app, template, hook) {
  describe('Google Drive Tests', function() {
    describe('Basic Plan', function() {
      if (!docker)
      before(function(done) {
        app.formio.formio.resources.project.model.findOne({_id: template.project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) return done(err);

          app.formio.formio.resources.submission.model.findOne({
            'data.licenseKeys.key': project.settings.licenseKey,
          }, function(err, sub) {
            if (err) return done(err);

            if (sub) {
              sub.data = {
                ...sub.data,
                plan: 'basic',
              };
            }

            sub.markModified('data');
            sub.save(function(err) {
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
        });
      });

      if (docker)
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

            var response = res.body;
            assert.equal(response.plan, 'basic');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      describe('GoogleDrive setup', function() {
        var testUser = {
          email: 'testUser@example.com',
          password: 'password'
        };

        it('A project on the basic plan can not set Google Drive settings', function(done) {
          request(app)
            .put('/project/' + template.project._id)
            .set('x-jwt-token', template.formio.owner.token)
            .send({
              settings: {
                cors: '*',
                google: {
                  clientId: 'CLIENT_ID',
                  cskey: 'CLIENT_SECRET',
                  refreshtoken: 'REFRESH'
                },
                storage: {
                  googleDrive: true,
                }
              }
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.plan, 'basic');
              assert.equal(response.hasOwnProperty('settings'), true);
              assert.deepEqual(_.omit(response.settings, ['licenseKey']), {cors: '*'});

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
            title: 'Upload Form GDrive',
            name: 'uploadFormGDrive',
            path: 'uploadfilegdrive',
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
                storage: 'googledrive',
                dir: ''
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
              template.forms.uploadFormDrive = response;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      describe('Google Drive', function() {
        it('A project on the basic plan can not access Google Drive', function(done) {

          const file = {
            name: 'myfile.doc',
            type: 'application/document',
            size: '10001'
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + template.forms.uploadFormDrive._id + '/storage/gdrive')
            .set('x-jwt-token', template.formio.owner.token)
            .send(file)
            .expect(402)
            .expect('Content-Type', /text/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      describe('S3 teardown', function() {
        it('Deletes the upload form', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + template.forms.uploadFormDrive._id)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              var response = res.body;
              assert.deepEqual(response, {});

              template.formio.owner.token = res.headers['x-jwt-token'];

              delete template.forms.uploadFormDrive;

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
    });

    describe('Commercial Plan', function() {
      if (!docker)
      before(function(done) {
        app.formio.formio.resources.project.model.findOne({_id: template.project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) return done(err);

          app.formio.formio.resources.submission.model.findOne({
            'data.licenseKeys.key': project.settings.licenseKey,
          }, function(err, sub) {
            if (err) return done(err);

            if (sub) {
              sub.data = {
                ...sub.data,
                plan: 'commercial',
              };
            }

            sub.markModified('data');
            sub.save(function(err) {
              if (err) return done(err);

              project.plan = 'commercial';
              project.save(function(err) {
                if (err) {
                  return done(err);
                }

                done();
              });
            });
          });
        });
      });

      if (docker)
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

            var response = res.body;
            assert.equal(response.plan, 'commercial');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });

      describe('Google Drive setup', function() {
        var testUser = {
          email: 'testUser@example.com',
          password: 'password'
        };

        it('Updates the project settings with Google Drive information', function(done) {
          var newSettings = {
            cors: '*',
            google: {
              clientId: 'CLIENT_ID',
              cskey: 'CLIENT_SECRET',
              refreshtoken: 'REFRESH'
            },
            storage: {
              googleDrive: true,
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
              assert.equal(response.plan, 'commercial');
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
            title: 'Upload Form GDrive',
            name: 'uploadFormGDrive',
            path: 'uploadfilegdrive',
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
                storage: 'googledrive',
                dir: ''
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
              template.forms.uploadFormDrive = response;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      describe('Google Drive', function() {
        it('Allows access to Google Drive signing POSTs for users with permission', function(done) {
          const file = {
            name: 'myfile.doc',
            type: 'application/document',
            size: '10001'
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + template.forms.uploadFormDrive._id + '/storage/gdrive')
            .set('x-jwt-token', template.formio.owner.token)
            .send(file)
            .expect(400)
            .expect('Content-Type', /text\/html/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              assert.equal(res.text, 'Bad request from Google Drive.');

              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      describe('S3 teardown', function() {
        it('Deletes the upload form', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + template.forms.uploadFormDrive._id)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              var response = res.body;
              assert.deepEqual(response, {});

              template.formio.owner.token = res.headers['x-jwt-token'];

              delete template.forms.uploadFormDrive;

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
    });
  });
};
