/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const async = require('async');
const _each = require('lodash/each');
const ObjectID = require('mongodb').ObjectId;

const config = require('../../config');
const { decrypt } = require('../../src/util/util');

module.exports = function(app, template, hook) {
  let Helper = require('formio/test/helper')(app);
  const cache = require('../../src/cache/cache')(app.formio);
  const Encryptor = require ('../../src/util/encrypt')(app.formio);

  describe('Encrypted Fields', function() {
    let tempForm;
    let helper = new Helper(template.formio.owner, template);

    let submissions = [
      {
        ssn: '080-23-1234',
        secret: 'test secret',
        a: 'hello2',
        datagrid: [
          {
            b: 'public3',
            c: 'private3'
          },
          {
            b: 'public4',
            c: 'private4'
          }
        ]
      },
      {
        ssn: '452-12-3453',
        secret: 'test secret test',
        a: 'hello2 test',
        datagrid: [
          {
            b: 'public6',
            c: 'private6'
          },
          {
            b: 'public5',
            c: 'private5'
          }
        ]
      },
      {
        ssn: '123-23-2345',
        secret: 'sshhhhhhh',
        a: 'hello',
        datagrid: [
          {
            b: 'public',
            c: 'private'
          },
          {
            b: 'public2',
            c: 'private2'
          }
        ]
      },
      {
        ssn: '999-33-2222',
        secret: 'this is super secret!!! do not tell anyone!',
        a: 'hello',
        datagrid: [
          {
            b: 'public',
            c: 'hush!'
          },
          {
            b: 'public2',
            c: 'you should not see this!'
          }
        ]
      }
    ];

    let getForm = (encrypted) => {
      encrypted = encrypted || false;
      return [
        {
          "encrypted": encrypted,
          "input": true,
          "tableView": true,
          "inputType": "text",
          "inputMask": "",
          "label": "SSN",
          "key": "ssn",
          "placeholder": "",
          "prefix": "",
          "suffix": "",
          "multiple": false,
          "defaultValue": "",
          "protected": false,
          "unique": false,
          "persistent": true,
          "hidden": false,
          "clearOnHide": true,
          "validate": {
            "required": false,
            "minLength": "",
            "maxLength": "",
            "pattern": "",
            "custom": "",
            "customPrivate": false
          },
          "conditional": {
            "show": "",
            "when": null,
            "eq": ""
          },
          "type": "textfield",
          "tags": [

          ],
          "properties": {
            "": ""
          }
        },
        {
          "clearOnHide": false,
          "input": false,
          "tableView": false,
          "key": "columns",
          "columns": [
            {
              "components": [
                {
                  "encrypted": encrypted,
                  "input": true,
                  "tableView": true,
                  "label": "Secret",
                  "key": "secret",
                  "placeholder": "",
                  "prefix": "",
                  "suffix": "",
                  "rows": 3,
                  "multiple": false,
                  "defaultValue": "",
                  "protected": false,
                  "persistent": true,
                  "hidden": false,
                  "wysiwyg": false,
                  "clearOnHide": true,
                  "validate": {
                    "required": false,
                    "minLength": "",
                    "maxLength": "",
                    "pattern": "",
                    "custom": ""
                  },
                  "type": "textarea",
                  "tags": [

                  ],
                  "conditional": {
                    "show": "",
                    "when": null,
                    "eq": ""
                  },
                  "properties": {
                    "": ""
                  }
                }
              ],
              "width": 6,
              "offset": 0,
              "push": 0,
              "pull": 0
            },
            {
              "components": [
                {
                  "input": true,
                  "tableView": true,
                  "inputType": "text",
                  "inputMask": "",
                  "label": "A",
                  "key": "a",
                  "placeholder": "",
                  "prefix": "",
                  "suffix": "",
                  "multiple": false,
                  "defaultValue": "",
                  "protected": false,
                  "unique": false,
                  "persistent": true,
                  "hidden": false,
                  "clearOnHide": true,
                  "validate": {
                    "required": false,
                    "minLength": "",
                    "maxLength": "",
                    "pattern": "",
                    "custom": "",
                    "customPrivate": false
                  },
                  "conditional": {
                    "show": "",
                    "when": null,
                    "eq": ""
                  },
                  "type": "textfield",
                  "tags": [

                  ],
                  "properties": {
                    "": ""
                  }
                },
                {
                  "input": true,
                  "tree": true,
                  "components": [
                    {
                      "input": true,
                      "tableView": true,
                      "inputType": "text",
                      "inputMask": "",
                      "label": "B",
                      "key": "b",
                      "placeholder": "",
                      "prefix": "",
                      "suffix": "",
                      "multiple": false,
                      "defaultValue": "",
                      "protected": false,
                      "unique": false,
                      "persistent": true,
                      "hidden": false,
                      "clearOnHide": true,
                      "validate": {
                        "required": false,
                        "minLength": "",
                        "maxLength": "",
                        "pattern": "",
                        "custom": "",
                        "customPrivate": false
                      },
                      "conditional": {
                        "show": "",
                        "when": null,
                        "eq": ""
                      },
                      "type": "textfield",
                      "hideLabel": true,
                      "tags": [

                      ],
                      "properties": {
                        "": ""
                      }
                    },
                    {
                      "encrypted": encrypted,
                      "input": true,
                      "tableView": true,
                      "inputType": "text",
                      "inputMask": "",
                      "label": "C",
                      "key": "c",
                      "placeholder": "",
                      "prefix": "",
                      "suffix": "",
                      "multiple": false,
                      "defaultValue": "",
                      "protected": false,
                      "unique": false,
                      "persistent": true,
                      "hidden": false,
                      "clearOnHide": true,
                      "validate": {
                        "required": false,
                        "minLength": "",
                        "maxLength": "",
                        "pattern": "",
                        "custom": "",
                        "customPrivate": false
                      },
                      "conditional": {
                        "show": "",
                        "when": null,
                        "eq": ""
                      },
                      "type": "textfield",
                      "hideLabel": true,
                      "tags": [

                      ],
                      "properties": {
                        "": ""
                      }
                    }
                  ],
                  "tableView": true,
                  "label": "DataGrid",
                  "key": "datagrid",
                  "protected": false,
                  "persistent": true,
                  "hidden": false,
                  "clearOnHide": true,
                  "type": "datagrid",
                  "tags": [

                  ],
                  "conditional": {
                    "show": "",
                    "when": null,
                    "eq": ""
                  },
                  "properties": {
                    "": ""
                  }
                }
              ],
              "width": 6,
              "offset": 0,
              "push": 0,
              "pull": 0
            }
          ],
          "type": "columns",
          "tags": [

          ],
          "conditional": {
            "show": "",
            "when": null,
            "eq": ""
          },
          "properties": {
            "": ""
          }
        },
        {
          "input": true,
          "label": "Submit",
          "tableView": false,
          "key": "submit",
          "size": "md",
          "leftIcon": "",
          "rightIcon": "",
          "block": false,
          "action": "submit",
          "disableOnInvalid": false,
          "theme": "primary",
          "type": "button"
        }
      ];
    };

    if (config.formio.hosted) {
      before('Enable the SaC Package', () => {
        process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
      });

      it('Create a temporary form for with non-encrypted fields', function(done) {
        helper.form('encryptedFields', getForm(false))
        .execute((err, results) => {
          if (err) {
            return done;
          }

          tempForm = results.getForm('encryptedFields');
          return done();
        });
      });

      it('Should create a few submissions as not encrypted', (done) => {
        helper.submission(`encryptedFields`, submissions[0])
          .execute((err, response1) => {
            if (err) {
              return done(err);
            }
            submissions[0] = response1.getLastSubmission();
            helper.submission(`encryptedFields`, submissions[1])
              .execute((err, response2) => {
                if (err) {
                  return done(err);
                }
                submissions[1] = response2.getLastSubmission();
                return done();
              });
          });
      });

      it('Should update the form to enable encryption on those fields', (done) => {
        tempForm.components = getForm(true);
        app.formio.formio.mongoose.model('form').updateOne({
          _id: ObjectID(tempForm._id)
        }, {
          '$set': {
            components: tempForm.components
          }
        }, (err, result) => {
          if (err) {
            return done(err);
          }

          done();
        });
      });

      it('Should not be able to create a submission with certain fields encrypted.', function(done) {
        helper.submission(`encryptedFields`, submissions[2])
          .execute((err, response) => {
            if (err) {
              return done(err);
            }

            submissions[2] = response.getLastSubmission();
            // Make sure the response does not allow encryption for anything other than commercial plans.
            assert.equal(submissions[2].data.ssn, 'Encryption requires Enterprise Plan');
            assert.equal(submissions[2].data.secret, 'Encryption requires Enterprise Plan');
            assert.equal(submissions[2].data.datagrid[0].c, 'Encryption requires Enterprise Plan');
            assert.equal(submissions[2].data.datagrid[1].c, 'Encryption requires Enterprise Plan');
            return done();
          });
      });

      it('Should not decrypt for anything other than commercial plan.', (done) => {
        request(app)
          .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${submissions[2]._id}`, template))
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.ssn, 'Encryption requires Enterprise Plan');
            assert.equal(res.body.data.secret, 'Encryption requires Enterprise Plan');
            assert.equal(res.body.data.datagrid[0].c, 'Encryption requires Enterprise Plan');
            assert.equal(res.body.data.datagrid[1].c, 'Encryption requires Enterprise Plan');
            return done();
          });
      });

      it('Should upgrade the project to "commercial"', (done) => {
        request(app)
          .post('/project/' + helper.template.project._id + '/upgrade')
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

      it('Should let you load the individual submission and show unencrypted.', (done) => {
        request(app)
          .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${submissions[2]._id}`, template))
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            submissions[2] = res.body;
            assert.equal(res.body.data.ssn, '123-23-2345');
            assert.equal(res.body.data.secret, 'sshhhhhhh');
            assert.equal(res.body.data.datagrid[0].c, 'private');
            assert.equal(res.body.data.datagrid[1].c, 'private2');
            return done();
          });
      });

      it('Should be able to still get the unencrypted fields', (done) => {
        request(app)
          .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${submissions[0]._id}`, template))
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.ssn, submissions[0].data.ssn);
            assert.equal(res.body.data.secret, submissions[0].data.secret);
            assert.equal(res.body.data.datagrid[0].c, submissions[0].data.datagrid[0].c);
            assert.equal(res.body.data.datagrid[1].c, submissions[0].data.datagrid[1].c);
            return done();
          });
      });

      it('The actual database object should be encrypted', (done) => {
        app.formio.formio.mongoose.model('submission').findOne({
          _id: ObjectID(submissions[2]._id)
        }, (err, submission) => {
          assert(submission.data.ssn.toString().length);
          assert(submission.data.secret.toString().length);
          assert(submission.data.datagrid[0].c.length);
          assert(submission.data.datagrid[1].c.length);
          assert(submission.data.ssn.toString() !== submissions[2].data.ssn);
          assert(submission.data.secret.toString() !== submissions[2].data.secret);
          assert(submission.data.datagrid[0].c.toString() !== submissions[2].data.datagrid[0].c);
          assert(submission.data.datagrid[1].c.toString() !== submissions[2].data.datagrid[1].c);
          done();
        });
      });

      it('Updating the submission should not double encrypt.', (done) => {
        submissions[2].data.ssn = '456-78-9012';
        submissions[2].data.datagrid[1].c = 'privateUpdated';
        helper.updateSubmission(submissions[2], (err, sub) => {
          if (err) {
            return done(err);
          }

          assert.equal(sub.data.ssn, submissions[2].data.ssn);
          assert.equal(sub.data.secret, submissions[2].data.secret);
          assert.equal(sub.data.datagrid[0].c, submissions[2].data.datagrid[0].c);
          assert.equal(sub.data.datagrid[1].c, submissions[2].data.datagrid[1].c);
          submissions[2] = sub;
          return done();
        });
      });

      it('The actual database object should be encrypted', (done) => {
        app.formio.formio.mongoose.model('submission').findOne({
          _id: ObjectID(submissions[2]._id)
        }, (err, submission) => {
          assert(submission.data.ssn.toString().length);
          assert(submission.data.secret.toString().length);
          assert(submission.data.datagrid[0].c.length);
          assert(submission.data.datagrid[1].c.length);
          assert(submission.data.ssn.toString() !== submissions[2].data.ssn);
          assert(submission.data.secret.toString() !== submissions[2].data.secret);
          assert(submission.data.datagrid[0].c.toString() !== submissions[2].data.datagrid[0].c);
          assert(submission.data.datagrid[1].c.toString() !== submissions[2].data.datagrid[1].c);
          done();
        });
      });

      it('Should let you load the individual submission and show unencrypted.', (done) => {
        request(app)
          .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${submissions[2]._id}`, template))
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.ssn, submissions[2].data.ssn);
            assert.equal(res.body.data.secret, submissions[2].data.secret);
            assert.equal(res.body.data.datagrid[0].c, submissions[2].data.datagrid[0].c);
            assert.equal(res.body.data.datagrid[1].c, submissions[2].data.datagrid[1].c);
            return done();
          });
      });

      it('Should create a new submission that gets encrypted', (done) => {
        helper.submission(`encryptedFields`, submissions[3])
          .execute((err, response) => {
            if (err) {
              return done(err);
            }

            submissions[3] = response.getLastSubmission();

            // Make sure the response shows that it is decrypted.
            assert.equal(submissions[3].data.ssn, '999-33-2222');
            assert.equal(submissions[3].data.secret, 'this is super secret!!! do not tell anyone!');
            assert.equal(submissions[3].data.datagrid[0].c, 'hush!');
            assert.equal(submissions[3].data.datagrid[1].c, 'you should not see this!');
            return done();
          });
      });

      it('The actual database object should be encrypted', (done) => {
        app.formio.formio.mongoose.model('submission').findOne({
          _id: ObjectID(submissions[3]._id)
        }, (err, submission) => {
          assert(submission.data.ssn.toString().length);
          assert(submission.data.secret.toString().length);
          assert(submission.data.datagrid[0].c.length);
          assert(submission.data.datagrid[1].c.length);
          assert(submission.data.ssn.toString() !== submissions[3].data.ssn);
          assert(submission.data.secret.toString() !== submissions[3].data.secret);
          assert(submission.data.datagrid[0].c.toString() !== submissions[3].data.datagrid[0].c);
          assert(submission.data.datagrid[1].c.toString() !== submissions[3].data.datagrid[1].c);
          done();
        });
      });

      it('Should let you load the individual submission and show unencrypted.', (done) => {
        request(app)
          .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${submissions[3]._id}`, template))
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.ssn, submissions[3].data.ssn);
            assert.equal(res.body.data.secret, submissions[3].data.secret);
            assert.equal(res.body.data.datagrid[0].c, submissions[3].data.datagrid[0].c);
            assert.equal(res.body.data.datagrid[1].c, submissions[3].data.datagrid[1].c);
            return done();
          });
      });

      it('Should fetch a full index and decrypt all items', (done) => {
        request(app)
          .get(hook.alter(`url`, `/form/${tempForm._id}/submission?sort=created`, template))
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.length, submissions.length);
            _each(submissions, (submission, index) => {
              assert.equal(res.body[index].data.ssn, submission.data.ssn);
              assert.equal(res.body[index].data.secret, submission.data.secret);
              assert.equal(res.body[index].data.datagrid[0].c, submission.data.datagrid[0].c);
              assert.equal(res.body[index].data.datagrid[1].c, submission.data.datagrid[1].c);
            });
            return done();
          });
      });

      it('Should downgrade the project to "trial"', (done) => {
        app.formio.formio.resources.project.model.findOne({_id: template.project._id, deleted: {$eq: null}}, function(err, project) {
          if (err) return done(err);

          app.formio.formio.resources.submission.model.findOne({
            'data.licenseKeys.key': project.settings.licenseKey,
          }, function(err, sub) {
            if (err) return done(err);

            if (sub) {
              sub.data = {
                ...sub.data,
                plan: 'trial',
              };
            }

            sub.markModified('data');
            app.formio.formio.resources.submission.model.updateOne({
              _id: sub._id
            },
            {$set: sub})
            .then(()=> {
              project.plan = 'trial';
              return app.formio.formio.resources.project.model.updateOne({_id: project._id},{$set: project})})
            .then(()=> {
              cache.loadCache.set(project.toObject());
             done()})
            .catch((err)=> {return done(err)});
          });
        });
      });

      after((done) => {
        delete template.forms.encryptedFields;
        let deleteUrls = [];
        _each(submissions, (submission) => {
          deleteUrls.push(hook.alter('url', '/form', template) + '/' + tempForm._id + '/submission/' + submission._id);
        });

        deleteUrls.push(hook.alter('url', '/form', template) + '/' + tempForm._id);

        // Cleanup shop.
        async.eachSeries(deleteUrls, (url, next) => {
          request(app)
            .delete(url)
            .set('x-jwt-token', template.formio.owner.token)
            .end(function(err, res) {
              if (err) {
                return next(err);
              }

              next();
            });
        }, done);
      });
    }

    let oldDbSecret;
    before('Sets the DB_SECRET variable', () => {
      oldDbSecret = config.formio.mongoSecret;
      config.formio.mongoSecret = 'MY_DB_SECRET_VALUE';
    });

    it('A project with no encryption secret key setting should fall back to the DB_SECRET variable', (done) => {
      const projectWithNoSecretKey = {
        settings: {}
      };
      const data = 'Hello, world!';
      const encrypted = Encryptor.getValue(projectWithNoSecretKey, 'encrypt', data, 'commercial');
      assert.notEqual(encrypted, 'Hello world!');
      const decrypted = decrypt('MY_DB_SECRET_VALUE', encrypted);
      assert.equal(decrypted, 'Hello, world!');
      done();
    });

    after('Disable the Sac Package and reset DB_SECRET', () => {
      process.env.TEST_SIMULATE_SAC_PACKAGE = false;
      config.formio.mongoSecret = oldDbSecret;
    });
  });

};
