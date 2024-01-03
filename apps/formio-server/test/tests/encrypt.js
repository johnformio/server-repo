/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const async = require('async');
const _each = require('lodash/each');
const ObjectID = require('mongodb').ObjectId;

const config = require('../../config');
const { decrypt } = require('../../src/util/util');

module.exports = function (app, template, hook) {
  let Helper = require('formio/test/helper')(app);
  const cache = require('../../src/cache/cache')(app.formio);
  const Encryptor = require('../../src/util/encrypt')(app.formio);

  describe('Encrypted Fields', function () {
    let tempForm;
    let helper = new Helper(template.formio.owner, template);

    let submissions = [
      {
        data: {
          ssn: '080-23-1234',
          secret: 'test secret',
          a: 'hello2',
          datagrid: [
            {
              b: 'public3',
              c: 'private3',
            },
            {
              b: 'public4',
              c: 'private4',
            },
          ],
        },
      },
      {
        data: {
          ssn: '452-12-3453',
          secret: 'test secret test',
          a: 'hello2 test',
          datagrid: [
            {
              b: 'public6',
              c: 'private6',
            },
            {
              b: 'public5',
              c: 'private5',
            },
          ],
        },
      },
      {
        data: {
          ssn: '123-23-2345',
          secret: 'sshhhhhhh',
          a: 'hello',
          datagrid: [
            {
              b: 'public',
              c: 'private',
            },
            {
              b: 'public2',
              c: 'private2',
            },
          ],
        },
      },
      {
        data: {
          ssn: '999-33-2222',
          secret: 'this is super secret!!! do not tell anyone!',
          a: 'hello',
          datagrid: [
            {
              b: 'public',
              c: 'hush!',
            },
            {
              b: 'public2',
              c: 'you should not see this!',
            },
          ],
        },
      },
    ];

    const getFormComponents = (encrypted) => {
      encrypted = encrypted || false;
      return [
        {
          encrypted: encrypted,
          input: true,
          tableView: true,
          inputType: 'text',
          inputMask: '',
          label: 'SSN',
          key: 'ssn',
          placeholder: '',
          prefix: '',
          suffix: '',
          multiple: false,
          defaultValue: '',
          protected: false,
          unique: false,
          persistent: true,
          hidden: false,
          clearOnHide: true,
          validate: {
            required: false,
            minLength: '',
            maxLength: '',
            pattern: '',
            custom: '',
            customPrivate: false,
          },
          conditional: {
            show: '',
            when: null,
            eq: '',
          },
          type: 'textfield',
          tags: [],
          properties: {
            '': '',
          },
        },
        {
          clearOnHide: false,
          input: false,
          tableView: false,
          key: 'columns',
          columns: [
            {
              components: [
                {
                  encrypted: encrypted,
                  input: true,
                  tableView: true,
                  label: 'Secret',
                  key: 'secret',
                  placeholder: '',
                  prefix: '',
                  suffix: '',
                  rows: 3,
                  multiple: false,
                  defaultValue: '',
                  protected: false,
                  persistent: true,
                  hidden: false,
                  wysiwyg: false,
                  clearOnHide: true,
                  validate: {
                    required: false,
                    minLength: '',
                    maxLength: '',
                    pattern: '',
                    custom: '',
                  },
                  type: 'textarea',
                  tags: [],
                  conditional: {
                    show: '',
                    when: null,
                    eq: '',
                  },
                  properties: {
                    '': '',
                  },
                },
              ],
              width: 6,
              offset: 0,
              push: 0,
              pull: 0,
            },
            {
              components: [
                {
                  input: true,
                  tableView: true,
                  inputType: 'text',
                  inputMask: '',
                  label: 'A',
                  key: 'a',
                  placeholder: '',
                  prefix: '',
                  suffix: '',
                  multiple: false,
                  defaultValue: '',
                  protected: false,
                  unique: false,
                  persistent: true,
                  hidden: false,
                  clearOnHide: true,
                  validate: {
                    required: false,
                    minLength: '',
                    maxLength: '',
                    pattern: '',
                    custom: '',
                    customPrivate: false,
                  },
                  conditional: {
                    show: '',
                    when: null,
                    eq: '',
                  },
                  type: 'textfield',
                  tags: [],
                  properties: {
                    '': '',
                  },
                },
                {
                  input: true,
                  tree: true,
                  components: [
                    {
                      input: true,
                      tableView: true,
                      inputType: 'text',
                      inputMask: '',
                      label: 'B',
                      key: 'b',
                      placeholder: '',
                      prefix: '',
                      suffix: '',
                      multiple: false,
                      defaultValue: '',
                      protected: false,
                      unique: false,
                      persistent: true,
                      hidden: false,
                      clearOnHide: true,
                      validate: {
                        required: false,
                        minLength: '',
                        maxLength: '',
                        pattern: '',
                        custom: '',
                        customPrivate: false,
                      },
                      conditional: {
                        show: '',
                        when: null,
                        eq: '',
                      },
                      type: 'textfield',
                      hideLabel: true,
                      tags: [],
                      properties: {
                        '': '',
                      },
                    },
                    {
                      encrypted: encrypted,
                      input: true,
                      tableView: true,
                      inputType: 'text',
                      inputMask: '',
                      label: 'C',
                      key: 'c',
                      placeholder: '',
                      prefix: '',
                      suffix: '',
                      multiple: false,
                      defaultValue: '',
                      protected: false,
                      unique: false,
                      persistent: true,
                      hidden: false,
                      clearOnHide: true,
                      validate: {
                        required: false,
                        minLength: '',
                        maxLength: '',
                        pattern: '',
                        custom: '',
                        customPrivate: false,
                      },
                      conditional: {
                        show: '',
                        when: null,
                        eq: '',
                      },
                      type: 'textfield',
                      hideLabel: true,
                      tags: [],
                      properties: {
                        '': '',
                      },
                    },
                  ],
                  tableView: true,
                  label: 'DataGrid',
                  key: 'datagrid',
                  protected: false,
                  persistent: true,
                  hidden: false,
                  clearOnHide: true,
                  type: 'datagrid',
                  tags: [],
                  conditional: {
                    show: '',
                    when: null,
                    eq: '',
                  },
                  properties: {
                    '': '',
                  },
                },
              ],
              width: 6,
              offset: 0,
              push: 0,
              pull: 0,
            },
          ],
          type: 'columns',
          tags: [],
          conditional: {
            show: '',
            when: null,
            eq: '',
          },
          properties: {
            '': '',
          },
        },
        {
          input: true,
          label: 'Submit',
          tableView: false,
          key: 'submit',
          size: 'md',
          leftIcon: '',
          rightIcon: '',
          block: false,
          action: 'submit',
          disableOnInvalid: false,
          theme: 'primary',
          type: 'button',
        },
      ];
    };

    describe('Hosted configuration', () => {
      if (!config.hosted) return;

      let projectId, formId;
      it('Creates a test project', (done) => {
        const testProject = {
          name: 'encryptedFieldsProject',
          title: 'encryptedFieldsProject',
          settings: {},
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(testProject)
          .expect(201)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(res.body._id, 'Project was created');
            projectId = res.body._id;
            done();
          });
      });

      it('Creates a form with non-encrypted fields', function (done) {
        request(app)
          .post(`/project/${projectId}/form`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(201)
          .send({
            name: 'testHostedEncryptedFieldsForm',
            path: 'testhostedencryptedfieldsform',
            title: 'Test Hosted Encrypted Fields Form',
            components: getFormComponents(false),
          })
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            assert(res.body, 'Form was created');
            formId = form.body._id;
            done();
          });
      });

      it('Should create a few submissions as not encrypted', (done) => {
        async.eachSeries(
          submissions.slice(0, 2),
          (submission, next) => {
            request(app)
              .post(`/project/${projectId}/form/${formId}/submission`)
              .set(`x-jwt-token`, template.formio.owner.token)
              .send(submission)
              .expect(201)
              .end((err, res) => {
                if (err) {
                  return next(err);
                }
                assert(res.body, 'Data was returned');
                submissions[submissions.indexOf(submission)] = res.body;
                next();
              });
          },
          done
        );
      });

      it('Should update the form to enable encryption on those fields in the db to simulate a user with encryption enabled prior to SaC Module encryption feature gate', (done) => {
        tempForm.components = getFormComponents(true);
        app.formio.formio.mongoose.model('form').updateOne(
          {
            _id: ObjectID(tempForm._id),
          },
          {
            $set: {
              components: tempForm.components,
            },
          },
          (err, result) => {
            if (err) {
              return done(err);
            }

            done();
          }
        );
      });

      it('Should be able to create a submission with certain fields encrypted.', function (done) {
        request(app)
          .post(`/project/${projectId}/form/${formId}/submission`)
          .send(submissions[2])
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            assert.equal(res.body.data.ssn, submissions[2].data.ssn);
            assert.equal(res.body.data.secret, submissions[2].data.secret);
            assert.equal(
              res.body.data.datagrid[0].b,
              submissions[2].data.datagrid[0].b
            );
            assert.equal(
              res.body.data.datagrid[0].c,
              submissions[2].data.datagrid[0].c
            );
            assert.equal(
              res.body.data.datagrid[1].b,
              submissions[2].data.datagrid[1].b
            );
            assert.equal(
              res.body.data.datagrid[1].c,
              submissions[2].data.datagrid[1].c
            );
            done();
          });
        helper
          .submission(`encryptedFields`, submissions[2])
          .execute((err, response) => {
            if (err) {
              return done(err);
            }

            submissions[2] = response.getLastSubmission();
            // Make sure the response does not allow encryption for anything other than commercial plans.
            assert.equal(
              submissions[2].data.ssn,
              'Encryption requires Enterprise Plan'
            );
            assert.equal(
              submissions[2].data.secret,
              'Encryption requires Enterprise Plan'
            );
            assert.equal(
              submissions[2].data.datagrid[0].c,
              'Encryption requires Enterprise Plan'
            );
            assert.equal(
              submissions[2].data.datagrid[1].c,
              'Encryption requires Enterprise Plan'
            );
            return done();
          });
      });

      it('Should not decrypt for anything other than commercial plan.', (done) => {
        request(app)
          .get(
            hook.alter(
              `url`,
              `/form/${tempForm._id}/submission/${submissions[2]._id}`,
              template
            )
          )
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(
              res.body.data.ssn,
              'Encryption requires Enterprise Plan'
            );
            assert.equal(
              res.body.data.secret,
              'Encryption requires Enterprise Plan'
            );
            assert.equal(
              res.body.data.datagrid[0].c,
              'Encryption requires Enterprise Plan'
            );
            assert.equal(
              res.body.data.datagrid[1].c,
              'Encryption requires Enterprise Plan'
            );
            return done();
          });
      });

      it('Should upgrade the project to "commercial"', (done) => {
        request(app)
          .post('/project/' + helper.template.project._id + '/upgrade')
          .set('x-jwt-token', template.formio.owner.token)
          .send({ plan: 'commercial' })
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it('Should downgrade the project to "trial"', (done) => {
        app.formio.formio.resources.project.model.findOne(
          { _id: template.project._id, deleted: { $eq: null } },
          function (err, project) {
            if (err) return done(err);

            app.formio.formio.resources.submission.model.findOne(
              {
                'data.licenseKeys.key': project.settings.licenseKey,
              },
              function (err, sub) {
                if (err) return done(err);

                if (sub) {
                  sub.data = {
                    ...sub.data,
                    plan: 'trial',
                  };
                }

                sub.markModified('data');
                sub.save(function (err) {
                  if (err) return done(err);

                  project.plan = 'trial';
                  project.save(function (err) {
                    if (err) {
                      return done(err);
                    }
                    cache.loadCache.set(project.toObject());
                    done();
                  });
                });
              }
            );
          }
        );
      });

      after((done) => {
        delete template.forms.encryptedFields;
        let deleteUrls = [];
        _each(submissions, (submission) => {
          deleteUrls.push(
            hook.alter('url', '/form', template) +
              '/' +
              tempForm._id +
              '/submission/' +
              submission._id
          );
        });

        deleteUrls.push(
          hook.alter('url', '/form', template) + '/' + tempForm._id
        );

        // Cleanup shop.
        async.eachSeries(
          deleteUrls,
          (url, next) => {
            request(app)
              .delete(url)
              .set('x-jwt-token', template.formio.owner.token)
              .end(function (err, res) {
                if (err) {
                  return next(err);
                }

                next();
              });
          },
          done
        );
      });
    });

    describe('With SAC Package enabled', () => {
      let projectId, formId;
      if (config.hosted) return;
      before('Simulates the SaC Module', () => {
        process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
      });

      it('A project with no encryption secret key setting should fall back to the DB_SECRET variable', (done) => {
        // store the DB_SECRET value
        const oldDbSecret = config.formio.mongoSecret;

        config.formio.mongoSecret = 'MY_DB_SECRET_VALUE';
        const projectWithNoSecretKey = {
          settings: {},
        };
        const data = 'Hello, world!';
        const encrypted = Encryptor.getValue(
          projectWithNoSecretKey,
          'encrypt',
          data,
          'commercial'
        );
        assert.notEqual(encrypted, 'Hello world!');
        const decrypted = decrypt('MY_DB_SECRET_VALUE', encrypted);
        assert.equal(decrypted, 'Hello, world!');

        // reset the DB_SECRET value
        config.formio.mongoSecret = oldDbSecret;
        done();
      });

      it('Creates a test project', (done) => {
        const testProject = {
          name: 'encryptedFieldsProject',
          title: 'encryptedFieldsProject',
          plan: 'commercial',
          settings: {},
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(testProject)
          .expect(201)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(res.body._id, 'Project was created');
            projectId = res.body._id;
            done();
          });
      });

      it('Creates a form with encrypted fields', function (done) {
        request(app)
          .post(`/project/${projectId}/form`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            name: 'testEncryptedFieldsForm',
            path: 'testencryptedfieldsform',
            title: 'Test Encrypted Fields Form',
            components: getFormComponents(true),
          })
          .expect(201)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(res.body._id, 'Form was created');
            formId = res.body._id;
            done();
          });
      });

      it('Submits with encrypted fields', async function () {
        for (let i = 0; i < submissions.length; i++) {
          let submission = submissions[i];
          const response = await request(app)
            .post(`/project/${projectId}/form/${formId}/submission`)
            .set('x-jwt-token', template.formio.owner.token)
            .send(submission)
            .expect(201);
          assert(response.body, 'Data was returned');
          submissions[i] = response.body;
        }
        return;
      });

      it('Should let you load the individual submission and show unencrypted.', (done) => {
        request(app)
          .get(
            `/project/${projectId}/form/${formId}/submission/${submissions[2]._id}`
          )
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
          .get(
            `/project/${projectId}/form/${formId}/submission/${submissions[0]._id}`
          )
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.ssn, submissions[0].data.ssn);
            assert.equal(res.body.data.secret, submissions[0].data.secret);
            assert.equal(
              res.body.data.datagrid[0].c,
              submissions[0].data.datagrid[0].c
            );
            assert.equal(
              res.body.data.datagrid[1].c,
              submissions[0].data.datagrid[1].c
            );
            return done();
          });
      });

      it('The actual database object should be encrypted', (done) => {
        app.formio.formio.mongoose.model('submission').findOne(
          {
            _id: ObjectID(submissions[2]._id),
          },
          (err, submission) => {
            if (err) {
              return done(err);
            }
            assert(submission.data.ssn.toString().length);
            assert(submission.data.secret.toString().length);
            assert(submission.data.datagrid[0].c.length);
            assert(submission.data.datagrid[1].c.length);
            assert(submission.data.ssn.toString() !== submissions[2].data.ssn);
            assert(
              submission.data.secret.toString() !== submissions[2].data.secret
            );
            assert(
              submission.data.datagrid[0].c.toString() !==
                submissions[2].data.datagrid[0].c
            );
            assert(
              submission.data.datagrid[1].c.toString() !==
                submissions[2].data.datagrid[1].c
            );
            done();
          }
        );
      });

      it('Updating the submission should not double encrypt.', (done) => {
        submissions[2].data.ssn = '456-78-9012';
        submissions[2].data.datagrid[1].c = 'privateUpdated';
        request(app)
          .put(
            `/project/${projectId}/form/${formId}/submission/${submissions[2]._id}`
          )
          .set(`x-jwt-token`, template.formio.owner.token)
          .send(submissions[2])
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            const returnedSubmission = res.body;
            assert(returnedSubmission, 'Data was returned');
            assert.equal(returnedSubmission.data.ssn, submissions[2].data.ssn);
            assert.equal(
              returnedSubmission.data.secret,
              submissions[2].data.secret
            );
            assert.equal(
              returnedSubmission.data.datagrid[0].c,
              submissions[2].data.datagrid[0].c
            );
            assert.equal(
              returnedSubmission.data.datagrid[1].c,
              submissions[2].data.datagrid[1].c
            );
            submissions[2] = returnedSubmission;
            return done();
          });
      });

      it('The actual database object should be encrypted', (done) => {
        app.formio.formio.mongoose.model('submission').findOne(
          {
            _id: ObjectID(submissions[2]._id),
          },
          (err, submission) => {
            assert(submission.data.ssn.toString().length);
            assert(submission.data.secret.toString().length);
            assert(submission.data.datagrid[0].c.length);
            assert(submission.data.datagrid[1].c.length);
            assert(submission.data.ssn.toString() !== submissions[2].data.ssn);
            assert(
              submission.data.secret.toString() !== submissions[2].data.secret
            );
            assert(
              submission.data.datagrid[0].c.toString() !==
                submissions[2].data.datagrid[0].c
            );
            assert(
              submission.data.datagrid[1].c.toString() !==
                submissions[2].data.datagrid[1].c
            );
            done();
          }
        );
      });

      it('Should let you load the individual submission and show unencrypted.', (done) => {
        request(app)
          .get(
            `/project/${projectId}/form/${formId}/submission/${submissions[2]._id}`
          )
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.ssn, submissions[2].data.ssn);
            assert.equal(res.body.data.secret, submissions[2].data.secret);
            assert.equal(
              res.body.data.datagrid[0].c,
              submissions[2].data.datagrid[0].c
            );
            assert.equal(
              res.body.data.datagrid[1].c,
              submissions[2].data.datagrid[1].c
            );
            return done();
          });
      });

      it('Should create a new submission that gets encrypted', (done) => {
        submissions.push({
          data: {
            ssn: '999-33-2222',
            secret: 'this is super secret!!! do not tell anyone!',
            a: 'hello',
            datagrid: [
              {
                b: 'public',
                c: 'hush!',
              },
              {
                b: 'public2',
                c: 'you should not see this!',
              },
            ],
          },
        });
        request(app)
          .post(`/project/${projectId}/form/${formId}/submission/`)
          .set(`x-jwt-token`, template.formio.owner.token)
          .send(submissions[submissions.length - 1])
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            assert(res.body, 'Returned data');
            const submission = (submissions[submissions.length - 1] = res.body);
            // Make sure the response shows that it is decrypted.
            assert.equal(submission.data.ssn, '999-33-2222');
            assert.equal(
              submission.data.secret,
              'this is super secret!!! do not tell anyone!'
            );
            assert.equal(submission.data.datagrid[0].c, 'hush!');
            assert.equal(
              submission.data.datagrid[1].c,
              'you should not see this!'
            );
            done();
          });
      });

      it('The actual database object should be encrypted', (done) => {
        app.formio.formio.mongoose.model('submission').findOne(
          {
            _id: ObjectID(submissions[3]._id),
          },
          (err, submission) => {
            if (err) {
              return done(err);
            }
            assert(submission.data.ssn.toString().length);
            assert(submission.data.secret.toString().length);
            assert(submission.data.datagrid[0].c.length);
            assert(submission.data.datagrid[1].c.length);
            assert(submission.data.ssn.toString() !== submissions[3].data.ssn);
            assert(
              submission.data.secret.toString() !== submissions[3].data.secret
            );
            assert(
              submission.data.datagrid[0].c.toString() !==
                submissions[3].data.datagrid[0].c
            );
            assert(
              submission.data.datagrid[1].c.toString() !==
                submissions[3].data.datagrid[1].c
            );
            done();
          }
        );
      });

      it('Should let you load the individual submission and show unencrypted.', (done) => {
        request(app)
          .get(
            `/project/${projectId}/form/${formId}/submission/${submissions[3]._id}`
          )
          .set(`x-jwt-token`, template.formio.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.ssn, submissions[3].data.ssn);
            assert.equal(res.body.data.secret, submissions[3].data.secret);
            assert.equal(
              res.body.data.datagrid[0].c,
              submissions[3].data.datagrid[0].c
            );
            assert.equal(
              res.body.data.datagrid[1].c,
              submissions[3].data.datagrid[1].c
            );
            return done();
          });
      });

      it('Should fetch a full index and decrypt all items', (done) => {
        request(app)
          .get(`/project/${projectId}/form/${formId}/submission?sort=created`)
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
              assert.equal(
                res.body[index].data.datagrid[0].c,
                submission.data.datagrid[0].c
              );
              assert.equal(
                res.body[index].data.datagrid[1].c,
                submission.data.datagrid[1].c
              );
            });
            return done();
          });
      });

      after('Disables the Sac Package', () => {
        process.env.TEST_SIMULATE_SAC_PACKAGE = false;
      });
    });

    describe('With SAC Package disabled', () => {
      let projectId, formId, oldEnv;
      if (config.hosted) return;
      before('Simulates the SaC Module disabled', () => {
        oldEnv = process.env.TEST_SIMULATE_SAC_PACKAGE;
        process.env.TEST_SIMULATE_SAC_PACKAGE = false;
      });

      it('Creates a test project', (done) => {
        const testProject = {
          name: 'encryptedFieldsProject2',
          title: 'encryptedFieldsProject2',
          plan: 'commercial',
          settings: {},
        };

        request(app)
          .post('/project')
          .set('x-jwt-token', template.formio.owner.token)
          .send(testProject)
          .expect(201)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(res.body._id, 'Project was created');
            projectId = res.body._id;
            done();
          });
      });

      it('Should fail to create a form with encrypted fields', function (done) {
        request(app)
          .post(`/project/${projectId}/form`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            name: 'testEncryptedFieldsForm',
            path: 'testencryptedfieldsform',
            title: 'Test Encrypted Fields Form',
            components: getFormComponents(true),
          })
          .expect(403)
          .end(done);
      });

      it('Should create a form without encrypted fields', function (done) {
        request(app)
          .post(`/project/${projectId}/form`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            name: 'testEncryptedFieldsForm2',
            path: 'testencryptedfieldsform2',
            title: 'Test Encrypted Fields Form 2',
            components: getFormComponents(false),
          })
          .expect(201)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            assert(res.body, "Data was returned");
            assert(res.body._id, "Created form has an id");
            formId = res.body._id;
            done();
          });
      });

      it('Should fail when fields are attempted to be modified for encryption', function (done) {
        request(app)
          .put(`/project/${projectId}/form/${formId}`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            name: 'testEncryptedFieldsForm2',
            path: 'testencryptedfieldsform2',
            title: 'Test Encrypted Fields Form 2',
            components: getFormComponents(true),
          })
          .expect(403)
          .end(done);
      });

      after('Restores the Sac Package value', () => {
        process.env.TEST_SIMULATE_SAC_PACKAGE = oldEnv;
      });
    });
  });
};
