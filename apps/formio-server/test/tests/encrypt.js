/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const async = require('async');
const ObjectID = require('mongodb').ObjectID;

module.exports = function(app, template, hook) {
  let Helper = require('formio/test/helper')(app);

  describe('Encrypted Fields', function() {
    let tempForm;
    let tempSubmission;
    let tempSubmission2;
    let helper = new Helper(template.formio.owner, template);

    before(function(done) {
      done();
    });

    after((done) => {
      var deleteUrls = [
        hook.alter('url', '/form', template) + '/' + tempForm._id + '/submission/' + tempSubmission._id,
        hook.alter('url', '/form', template) + '/' + tempForm._id + '/submission/' + tempSubmission2._id,
        hook.alter('url', '/form', template) + '/' + tempForm._id
      ];

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

    it('Create a temporary form for with encrypted fields', function(done) {
      helper.form('encryptedFields', [
        {
          "encrypted": true,
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
                  "encrypted": true,
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
                      "encrypted": true,
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
      ])
      .execute((err, results) => {
        if (err) {
          return done;
        }

        tempForm = results.getForm('encryptedFields');
        return done();
      });
    });

    it('Should be able to create a message with certain fields encrypted.', function(done) {
      helper.submission(`encryptedFields`, {
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
        })
        .execute((err, response) => {
          if (err) {
            return done(err);
          }

          tempSubmission = response.getLastSubmission();

          // Make sure the response shows that it is decrypted.
          assert.equal(tempSubmission.data.ssn, '123-23-2345');
          assert.equal(tempSubmission.data.secret, 'sshhhhhhh');
          assert.equal(tempSubmission.data.datagrid[0].c, 'private');
          assert.equal(tempSubmission.data.datagrid[1].c, 'private2');
          return done();
        });
    });

    it('The actual database object should be encrypted', (done) => {
      app.formio.formio.mongoose.model('submission').findOne({
        _id: ObjectID(tempSubmission._id)
      }, (err, submission) => {
        assert(submission.data.ssn.toString().length);
        assert(submission.data.secret.toString().length);
        assert(submission.data.datagrid[0].c.length);
        assert(submission.data.datagrid[1].c.length);
        assert(submission.data.ssn.toString() !== tempSubmission.data.ssn);
        assert(submission.data.secret.toString() !== tempSubmission.data.secret);
        assert(submission.data.datagrid[0].c.toString() !== tempSubmission.data.datagrid[0].c);
        assert(submission.data.datagrid[1].c.toString() !== tempSubmission.data.datagrid[1].c);
        done();
      });
    });

    it('Should let you load the individual submission and show unencrypted.', (done) => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`, template))
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.ssn, tempSubmission.data.ssn);
          assert.equal(res.body.data.secret, tempSubmission.data.secret);
          assert.equal(res.body.data.datagrid[0].c, tempSubmission.data.datagrid[0].c);
          assert.equal(res.body.data.datagrid[1].c, tempSubmission.data.datagrid[1].c);
          return done();
        });
    });

    it('Updating the submission should not double encrypt.', (done) => {
      tempSubmission.data.ssn = '456-78-9012';
      tempSubmission.data.datagrid[1].c = 'privateUpdated';
      helper.updateSubmission(tempSubmission, (err, sub) => {
        if (err) {
          return done(err);
        }

        assert.equal(sub.data.ssn, tempSubmission.data.ssn);
        assert.equal(sub.data.secret, tempSubmission.data.secret);
        assert.equal(sub.data.datagrid[0].c, tempSubmission.data.datagrid[0].c);
        assert.equal(sub.data.datagrid[1].c, tempSubmission.data.datagrid[1].c);
        tempSubmission = sub;
        return done();
      });
    });

    it('The actual database object should be encrypted', (done) => {
      app.formio.formio.mongoose.model('submission').findOne({
        _id: ObjectID(tempSubmission._id)
      }, (err, submission) => {
        assert(submission.data.ssn.toString().length);
        assert(submission.data.secret.toString().length);
        assert(submission.data.datagrid[0].c.length);
        assert(submission.data.datagrid[1].c.length);
        assert(submission.data.ssn.toString() !== tempSubmission.data.ssn);
        assert(submission.data.secret.toString() !== tempSubmission.data.secret);
        assert(submission.data.datagrid[0].c.toString() !== tempSubmission.data.datagrid[0].c);
        assert(submission.data.datagrid[1].c.toString() !== tempSubmission.data.datagrid[1].c);
        done();
      });
    });

    it('Should let you load the individual submission and show unencrypted.', (done) => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission._id}`, template))
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.ssn, tempSubmission.data.ssn);
          assert.equal(res.body.data.secret, tempSubmission.data.secret);
          assert.equal(res.body.data.datagrid[0].c, tempSubmission.data.datagrid[0].c);
          assert.equal(res.body.data.datagrid[1].c, tempSubmission.data.datagrid[1].c);
          return done();
        });
    });

    it('Should create a new submission that gets encrypted', (done) => {
      helper.submission(`encryptedFields`, {
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
      })
        .execute((err, response) => {
          if (err) {
            return done(err);
          }

          tempSubmission2 = response.getLastSubmission();

          // Make sure the response shows that it is decrypted.
          assert.equal(tempSubmission2.data.ssn, '999-33-2222');
          assert.equal(tempSubmission2.data.secret, 'this is super secret!!! do not tell anyone!');
          assert.equal(tempSubmission2.data.datagrid[0].c, 'hush!');
          assert.equal(tempSubmission2.data.datagrid[1].c, 'you should not see this!');
          return done();
        });
    });

    it('The actual database object should be encrypted', (done) => {
      app.formio.formio.mongoose.model('submission').findOne({
        _id: ObjectID(tempSubmission2._id)
      }, (err, submission) => {
        assert(submission.data.ssn.toString().length);
        assert(submission.data.secret.toString().length);
        assert(submission.data.datagrid[0].c.length);
        assert(submission.data.datagrid[1].c.length);
        assert(submission.data.ssn.toString() !== tempSubmission2.data.ssn);
        assert(submission.data.secret.toString() !== tempSubmission2.data.secret);
        assert(submission.data.datagrid[0].c.toString() !== tempSubmission2.data.datagrid[0].c);
        assert(submission.data.datagrid[1].c.toString() !== tempSubmission2.data.datagrid[1].c);
        done();
      });
    });

    it('Should let you load the individual submission and show unencrypted.', (done) => {
      request(app)
        .get(hook.alter(`url`, `/form/${tempForm._id}/submission/${tempSubmission2._id}`, template))
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.ssn, tempSubmission2.data.ssn);
          assert.equal(res.body.data.secret, tempSubmission2.data.secret);
          assert.equal(res.body.data.datagrid[0].c, tempSubmission2.data.datagrid[0].c);
          assert.equal(res.body.data.datagrid[1].c, tempSubmission2.data.datagrid[1].c);
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

          assert.equal(res.body.length, 2);
          assert.equal(res.body[0].data.ssn, tempSubmission.data.ssn);
          assert.equal(res.body[0].data.secret, tempSubmission.data.secret);
          assert.equal(res.body[0].data.datagrid[0].c, tempSubmission.data.datagrid[0].c);
          assert.equal(res.body[0].data.datagrid[1].c, tempSubmission.data.datagrid[1].c);
          assert.equal(res.body[1].data.ssn, tempSubmission2.data.ssn);
          assert.equal(res.body[1].data.secret, tempSubmission2.data.secret);
          assert.equal(res.body[1].data.datagrid[0].c, tempSubmission2.data.datagrid[0].c);
          assert.equal(res.body[1].data.datagrid[1].c, tempSubmission2.data.datagrid[1].c);
          return done();
        });
    });
  });
};
