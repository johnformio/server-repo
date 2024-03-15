/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var CryptoJS = require('crypto-js');
const {S3Client, GetObjectCommand} = require('@aws-sdk/client-s3');
const {getSignedUrl} = require("@aws-sdk/s3-request-presigner");
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;
var _ = require('lodash');
const config = require('../../config');
const { storages } = require('../../src/storage');
const s3Storage = storages.s3;

module.exports = function(app, template, hook) {
  describe('S3 Tests', function() {
    before((done) => {
      process.env.ADMIN_KEY = 'examplekey';
      done();
    });

    describe('Basic Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'basic'
          })
          .set('x-admin-key', config.formio.hosted ? process.env.ADMIN_KEY : '')
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

      describe('S3 setup', function() {
        var testUser = {
          email: 'testUser@example.com',
          password: 'password'
        };

        if (config.formio.hosted) {
          it('A project on the basic plan can not set S3 settings', function(done) {
            request(app)
              .put('/project/' + template.project._id)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                settings: {
                  cors: '*',
                  storage: {
                    s3: {
                      AWSAccessKeyId: 'abcdefghijklmnop',
                      AWSSecretKey: 'jsd09u04j0f9sue0f9j34wesd',
                      bucket: 'testbucket',
                      bucketUrl: 'https://testbucket.aws.amazon.com/',
                      startsWith: 'upload/',
                      acl: 'private',
                      maxSize: 100 * 1024 * 1024,
                      expiration: 15 * 60
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
        }

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
              },
              {
                type: 'delete_own',
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
                storage: 's3',
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

      describe('S3', function() {
        it('A project on the basic plan can not access s3 signing', function(done) {
          var file = {
            name: 'myfile.doc',
            type: 'application/document',
            size: '10001'
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3')
            .set('x-jwt-token', template.users.tempUser.token)
            .send(file)
            .expect(402)
            .expect('Content-Type', /text/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('A project on the basic plan can not delete s3 file', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=test')
            .set('x-jwt-token', template.users.tempUser.token)
            .expect(402)
            .expect('Content-Type', /text/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      describe('S3 teardown', function() {
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
    });

    describe('Independent Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'independent'
          })
          .set('x-admin-key', config.formio.hosted ? process.env.ADMIN_KEY : '')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.plan, 'independent');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
        });

      describe('S3 setup', function() {
        var testUser = {
          email: 'testUser@example.com',
          password: 'password'
        };

        if (config.formio.hosted) {
          it('A project on the independent plan can not set S3 settings', function(done) {
            request(app)
              .put('/project/' + template.project._id)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                settings: {
                  cors: '*',
                  storage: {
                    s3: {
                      AWSAccessKeyId: 'abcdefghijklmnop',
                      AWSSecretKey: 'jsd09u04j0f9sue0f9j34wesd',
                      bucket: 'testbucket',
                      bucketUrl: 'https://testbucket.aws.amazon.com/',
                      startsWith: 'upload/',
                      acl: 'private',
                      maxSize: 100 * 1024 * 1024,
                      expiration: 15 * 60
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

                var response = res.body;
                assert.equal(response.plan, 'independent');
                assert.equal(response.hasOwnProperty('settings'), true);
                assert.deepEqual(_.omit(response.settings, ['licenseKey']), {cors: '*'});

                template.project = response;

                // Store the JWT for future API calls.
                template.formio.owner.token = res.headers['x-jwt-token'];

                done();
              });
          });
        }

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
              },
              {
                type: 'delete_own',
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
                storage: 's3',
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

      describe('S3', function() {
        if (config.formio.hosted) {
          it('A project on the independent plan can not access s3 signing', function(done) {
            var file = {
              name: 'myfile.doc',
              type: 'application/document',
              size: '10001'
            };

            request(app)
              .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3')
              .set('x-jwt-token', template.users.tempUser.token)
              .send(file)
              .expect(402)
              .expect('Content-Type', /text/)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                template.users.tempUser.token = res.headers['x-jwt-token'];

                done();
              });
          });

          it('A project on the independent plan can not delete s3 file', function(done) {
            request(app)
              .delete('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=upload/myfile.doc')
              .set('x-jwt-token', template.users.tempUser.token)
              .expect(402)
              .expect('Content-Type', /text/)
              .end(function(err, res) {
                if (err) {
                  return done(err);
                }

                template.users.tempUser.token = res.headers['x-jwt-token'];

                done();
              });
          });
        }
      });

      describe('S3 teardown', function() {
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
    });

    describe('Team Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'team'
          })
          .set('x-admin-key', config.formio.hosted ? process.env.ADMIN_KEY : '')
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            var response = res.body;
            assert.equal(response.plan, 'team');
            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];
            done();
          });
      });

      describe('S3 setup', function() {
        var testUser = {
          email: 'testUser@example.com',
          password: 'password'
        };

        it('Updates the project settings with s3 information', function(done) {
          var newSettings = {
            cors: '*',
            storage: {
              s3: {
                AWSAccessKeyId: 'abcdefghijklmnop',
                AWSSecretKey: 'jsd09u04j0f9sue0f9j34wesd',
                bucket: 'testbucket',
                bucketUrl: 'https://testbucket.aws.amazon.com/',
                startsWith: 'upload/',
                acl: 'private',
                maxSize: 100 * 1024 * 1024,
                expiration: 15 * 60
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
              assert.equal(response.plan, 'team');
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
              },
              {
                type: 'delete_own',
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
                storage: 's3',
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

      describe('S3', function() {
        it('Allows access to s3 signing POSTs for users with permission', function(done) {
          var file = {
            name: 'myfile.doc',
            type: 'application/document',
            size: '10001'
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3')
            .set('x-jwt-token', template.users.tempUser.token)
            .send(file)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              assert.equal(res.body.bucket, template.project.settings.storage.s3.bucket);
              assert.equal(res.body.url, template.project.settings.storage.s3.bucketUrl);
              assert.equal(res.body.data.key, template.project.settings.storage.s3.startsWith);
              assert.equal(res.body.data.AWSAccessKeyId, template.project.settings.storage.s3.AWSAccessKeyId);
              assert.equal(res.body.data.acl, template.project.settings.storage.s3.acl);
              assert.equal(res.body.data['Content-Type'], file.type);
              assert.equal(res.body.data.filename, file.name);

              var expiration_seconds = template.project.settings.storage.s3.expiration || (15 * 60);
              var expiration = new Date(Date.now() + (expiration_seconds * 1000));

              var policy = {
                expiration: expiration.toISOString(),
                conditions: [
                  {"bucket": template.project.settings.storage.s3.bucket},
                  ["starts-with", "$key", template.project.settings.storage.s3.startsWith],
                  {"acl": template.project.settings.storage.s3.acl},
                  ["starts-with", "$Content-Type", ""],
                  ["starts-with", "$filename", ""],
                  ["content-length-range", 0, template.project.settings.storage.s3.maxSize]
                ]
              };

              // Policy signatures are time sensitive so we have to match the time or the signatures won't work.
              var serverPolicy = JSON.parse(new Buffer.from(res.body.data.policy, 'base64').toString('binary'));
              policy.expiration = serverPolicy.expiration;

              var policyBase64 = new Buffer.from(JSON.stringify(policy)).toString('base64');

              assert.equal(res.body.data.policy, policyBase64);
              assert.equal(res.body.data.signature, CryptoJS.HmacSHA1(policyBase64, template.project.settings.storage.s3.AWSSecretKey).toString(CryptoJS.enc.Base64));

              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Allows access to s3 signing GETs for users with permission', function(done) {
          var file = {
            key: 'upload/myfile.doc',
            bucket: 'testbucket'
          };

          request(app)
            .get('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=upload/myfile.doc')
            .set('x-jwt-token', template.users.tempUser.token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }
              var s3 = new S3Client({
                region: 'us-east-1',
                credentials: {
                  accessKeyId: template.project.settings.storage.s3.AWSAccessKeyId,
                  secretAccessKey: template.project.settings.storage.s3.AWSSecretKey
                }
              });
              getSignedUrl(s3, new GetObjectCommand({
                Bucket: file.bucket,
                Key: file.key
              }, {expiresIn: +template.project.settings.storage.s3.expiration})).then(url => {
                if (!docker && !customer) {
                  assert.equal(res.body.url.replace(/Expires=[0-9]*/, ''), url.replace(/Expires=[0-9]*/, ''));
                }
                done();
              }).catch(err => done(err));
            });
        });

        it('Allows access to delete s3 file for users with permission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=test')
            .set('x-jwt-token', template.users.tempUser.token)
            .expect(400)
            .expect('Content-Type', /text/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.equal(res.text, 'The AWS Access Key Id you provided does not exist in our records.');


              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Does not allows access to s3 signing POSTs for users without permission', function(done) {
          var file = {
            name: 'myfile.doc',
            type: 'application/document',
            size: '10001'
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3')
            .send(file)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Does not allows access to s3 signing GETs for users without permission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=upload/myfile.doc')
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Does not allows access to delete s3 file for users without permission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=upload/myfile.doc')
            .expect(401)
            .expect('Content-Type', /text/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      describe('S3 teardown', function() {
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
    });

    describe('Commercial Plan', function() {
      before(function(done) {
        request(app)
          .put('/project/' + template.project._id)
          .send({
            plan: 'commercial'
          })
          .set('x-admin-key', config.formio.hosted ? process.env.ADMIN_KEY : '')
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

      describe('S3 setup', function() {
        var testUser = {
          email: 'testUser@example.com',
          password: 'password'
        };

        it('Updates the project settings with s3 information', function(done) {
          var newSettings = {
            cors: '*',
            storage: {
              s3: {
                AWSAccessKeyId: 'abcdefghijklmnop',
                AWSSecretKey: 'jsd09u04j0f9sue0f9j34wesd',
                bucket: 'testbucket',
                bucketUrl: 'https://testbucket.aws.amazon.com/',
                startsWith: 'upload/',
                acl: 'private',
                maxSize: 100 * 1024 * 1024,
                expiration: 15 * 60
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
              },
              {
                type: 'delete_own',
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
                storage: 's3',
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

      describe('S3', function() {
        it('Allows access to s3 signing POSTs for users with permission', function(done) {
          var file = {
            name: 'myfile.doc',
            type: 'application/document',
            size: '10001'
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3')
            .set('x-jwt-token', template.users.tempUser.token)
            .send(file)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              assert.equal(res.body.bucket, template.project.settings.storage.s3.bucket);
              assert.equal(res.body.url, template.project.settings.storage.s3.bucketUrl);
              assert.equal(res.body.data.key, template.project.settings.storage.s3.startsWith);
              assert.equal(res.body.data.AWSAccessKeyId, template.project.settings.storage.s3.AWSAccessKeyId);
              assert.equal(res.body.data.acl, template.project.settings.storage.s3.acl);
              assert.equal(res.body.data['Content-Type'], file.type);
              assert.equal(res.body.data.filename, file.name);

              var expiration_seconds = template.project.settings.storage.s3.expiration || (15 * 60);
              var expiration = new Date(Date.now() + (expiration_seconds * 1000));

              var policy = {
                expiration: expiration.toISOString(),
                conditions: [
                  {"bucket": template.project.settings.storage.s3.bucket},
                  ["starts-with", "$key", template.project.settings.storage.s3.startsWith],
                  {"acl": template.project.settings.storage.s3.acl},
                  ["starts-with", "$Content-Type", ""],
                  ["starts-with", "$filename", ""],
                  ["content-length-range", 0, template.project.settings.storage.s3.maxSize]
                ]
              };

              // Policy signatures are time sensitive so we have to match the time or the signatures won't work.
              var serverPolicy = JSON.parse(new Buffer.from(res.body.data.policy, 'base64').toString('binary'));
              policy.expiration = serverPolicy.expiration;

              var policyBase64 = new Buffer.from(JSON.stringify(policy)).toString('base64');

              assert.equal(res.body.data.policy, policyBase64);
              assert.equal(res.body.data.signature, CryptoJS.HmacSHA1(policyBase64, template.project.settings.storage.s3.AWSSecretKey).toString(CryptoJS.enc.Base64));

              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Allows access to s3 signing GETs for users with permission', function(done) {
          var file = {
            key: 'upload/myfile.doc',
            bucket: 'testbucket'
          };

          request(app)
            .get('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=upload/myfile.doc')
            .set('x-jwt-token', template.users.tempUser.token)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }
              var s3 = new S3Client({
                region: 'us-east-1',
                credentials: {
                  accessKeyId: template.project.settings.storage.s3.AWSAccessKeyId,
                  secretAccessKey: template.project.settings.storage.s3.AWSSecretKey
                }
              });
              getSignedUrl(s3, new GetObjectCommand({
                Bucket: file.bucket,
                Key: file.key
              }, {expiresIn: +template.project.settings.storage.s3.expiration})).then(url => {
                if (!docker && !customer) {
                  assert.equal(res.body.url.replace(/Expires=[0-9]*/, ''), url.replace(/Expires=[0-9]*/, ''));
                }
                done();
              }).catch(err => done(err));
            });
        });

        it('Allows access to delete s3 file for users with permission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=test')
            .set('x-jwt-token', template.users.tempUser.token)
            .expect(400)
            .expect('Content-Type', /text/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.equal(res.text, 'The AWS Access Key Id you provided does not exist in our records.');


              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });

        it('Does not allows access to s3 signing POSTs for users without permission', function(done) {
          var file = {
            name: 'myfile.doc',
            type: 'application/document',
            size: '10001'
          };

          request(app)
            .post('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3')
            .send(file)
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Does not allows access to s3 signing GETs for users without permission', function(done) {
          request(app)
            .get('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=upload/myfile.doc')
            .expect(401)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              done();
            });
        });

        it('Does not allows access to delete s3 file for users without permission', function(done) {
          request(app)
            .delete('/project/' + template.project._id + '/form/' + template.forms.uploadForm._id + '/storage/s3?bucket=testbucket&key=upload/myfile.doc')
            .expect(401)
            .expect('Content-Type', /text/)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              template.users.tempUser.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });

      describe('S3 teardown', function() {
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
    });

    describe('Email Actions', () => {
      let file;
      before(() => {
        file = {
          bucket: 'fakeBucket',
          key: 'fakeKey',
        };
      });

      it('Should throw error if file not provided', async () => {
        try {
          await s3Storage.getEmailFileUrl(template.project);
        }
        catch(err) {
          assert.equal(err.message, 'File not provided.');
        }
      });

      it('Should throw error if storage settings not set', async () => {
        try {
          const project = {
            ...template.project,
            settings: {},
          };
          await s3Storage.getEmailFileUrl(project, file);
          assert.fail('Expected an error to be thrown');
        }
        catch(err) {
          assert.equal(err.message, 'Storage settings not set.');
        }
      });

      it('Should return file url for email attachment', async () => {
        try {
          const url = await s3Storage.getEmailFileUrl(template.project, file);
          assert.ok(url && url.startsWith('https://s3.us-east-1.amazonaws.com/fakeBucket/fakeKey'));
        }
        catch(err) {
          assert.fail('An error should not be thrown');
        }
      });
    });

    after((done) => {
      delete process.env.ADMIN_KEY;
      done();
    });
  });
};
