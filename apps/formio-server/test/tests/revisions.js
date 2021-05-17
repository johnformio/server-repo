/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var util = require('formio/src/util/util');

module.exports = (app, template, hook) => {
  let helper = new template.Helper(template.formio.owner);
  let form;

  describe('Form Revisions', () => {
    before((done) => {
      process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'examplekey';
      done();
    });

    it('Creates a test project and form', done => {
      helper
        .project()
        .plan('trial')
        .form('revisionForm', [
          {
            input: true,
            tableView: true,
            inputType: 'text',
            inputMask: '',
            label: 'fname',
            key: 'fname',
            placeholder: '',
            prefix: '',
            suffix: '',
            multiple: false,
            defaultValue: '',
            protected: false,
            unique: false,
            persistent: true,
            validate: {
              required: true,
              minLength: '',
              maxLength: '',
              pattern: '',
              custom: '',
              customPrivate: false
            },
            conditional: {
              show: '',
              when: null,
              eq: ''
            },
            type: 'textfield'
          },
          {
            input: true,
            tableView: true,
            inputType: 'text',
            inputMask: '',
            label: 'lname',
            key: 'lname',
            placeholder: '',
            prefix: '',
            suffix: '',
            multiple: false,
            defaultValue: '',
            protected: false,
            unique: false,
            persistent: true,
            validate: {
              required: true,
              minLength: '',
              maxLength: '',
              pattern: '',
              custom: '',
              customPrivate: false
            },
            conditional: {
              show: '',
              when: null,
              eq: ''
            },
            type: 'textfield'
          }
        ])
        .execute(function() {
          form = helper.getForm('revisionForm');
          assert(typeof form === 'object');
          done();
        });
    });

    it('Form with revisions should being created with the admin key', (done) => {
      const method = 'post';
      let url = '';

      if (helper.template.project && helper.template.project._id) {
        url += `/project/${helper.template.project._id}`;
      }

      url += '/form';

      const data = {
        title: 'Form with Revisions by Admin',
        name: 'formRevisionsAdmin',
        path: 'formRevisionsAdmin',
        type: 'form',
        access: [],
        revisions: 'original',
        submissionAccess:[],
        components: [
          {
            input: true,
            tableView: true,
            inputType: 'text',
            label: 'fname',
            key: 'fname',
            persistent: true,
            type: 'textfield'
          },
        ]
      };

      request(app)[method](url)
      .set('x-admin-key', process.env.ADMIN_KEY)
      .send(data)
      .expect('Content-Type', /json/)
      .expect(201)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        helper.template.forms[data.name] = res.body;
        done();
      });
    });

    it('Sets a form to use revisions', done => {
      form.revisions = 'original';
      form.components.push();
      helper.updateForm(form, (err, result) => {
        assert.equal(result.revisions, 'original');
        helper.getFormRevisions(result, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 1);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Creates a new revision when a form is updated', done => {
      form.components.push({
        input: true,
        tableView: true,
        inputType: 'text',
        inputMask: '',
        label: 'mname',
        key: 'mname',
        placeholder: '',
        prefix: '',
        suffix: '',
        multiple: false,
        defaultValue: '',
        protected: false,
        unique: false,
        persistent: true,
        validate: {
          required: true,
          minLength: '',
          maxLength: '',
          pattern: '',
          custom: '',
          customPrivate: false
        },
        conditional: {
          show: '',
          when: null,
          eq: ''
        },
        type: 'textfield'
      });
      helper.updateForm(form, (err, result) => {
        helper.getFormRevisions(result, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 2);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Creates another new revision when a form is updated', done => {
      form.components.push({
        input: true,
        tableView: true,
        inputType: 'text',
        inputMask: '',
        label: 'pname',
        key: 'pname',
        placeholder: '',
        prefix: '',
        suffix: '',
        multiple: false,
        defaultValue: '',
        protected: false,
        unique: false,
        persistent: true,
        validate: {
          required: true,
          minLength: '',
          maxLength: '',
          pattern: '',
          custom: '',
          customPrivate: false
        },
        conditional: {
          show: '',
          when: null,
          eq: ''
        },
        type: 'textfield'
      });
      helper.updateForm(form, (err, result) => {
        helper.getFormRevisions(result, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 3);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Does not Create a new revision when a form is not updated', done => {
      helper.updateForm(form, (err, result) => {
        helper.getFormRevisions(result, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 3);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Can access a revision by id', done => {
      helper.getFormRevision(form, 3, (err, result) => {
        assert.equal(result.components.length, 4);
        assert.equal(result._vid, 3);
        assert.equal(result._rid, form._id);
        assert.equal(result.name, form.name);
        assert(result.hasOwnProperty('machineName') === false);
        done();
      });
    });

    it('Returns a 404 for a non-existent revision', done => {
      helper.getFormRevision(form, 4, (err, result) => {
        assert.equal(result.status, 404);
        done();
      });
    });

    it('Returns a draft as the last saved version if no existing draft', done => {
      helper.getFormDraft(form, (err, result) => {
        if (err) {
          return done(err);
        }
        assert.equal(result._vid, 3);
        done();
      });
    });

    it('Saves a draft', done => {
      helper.putFormDraft(form, (err, result) => {
        if (err) {
          return done(err);
        }
        assert.equal(result._vid, 'draft');
        helper.getFormRevisions(form, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 4);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 'draft');
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Returns a draft if it exists', done => {
      helper.getFormDraft(form, (err, result) => {
        if (err) {
          return done(err);
        }
        assert.equal(result._vid, 'draft');
        done();
      });
    });

    it('Saves a draft over existing drafts', done => {
      helper.putFormDraft(form, (err, result) => {
        if (err) {
          return done(err);
        }
        assert.equal(result._vid, 'draft');
        helper.getFormRevisions(form, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 4);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 'draft');
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Deletes the draft when a new version is created', done => {
      form.components[0].prefix = 'from draft';
      helper.updateForm(form, (err, result) => {
        if (err) {
          return done(err);
        }
        helper.getFormRevisions(form, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 4);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 4);
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Saves a new draft', done => {
      helper.putFormDraft(form, (err, result) => {
        if (err) {
          return done(err);
        }
        assert.equal(result._vid, 'draft');
        helper.getFormRevisions(form, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 5);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 4);
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          assert.equal(result[4].components.length, 4);
          assert.equal(result[4]._vid, 'draft');
          assert.equal(result[4]._rid, form._id);
          assert.equal(result[4].name, form.name);
          assert(result[4].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Publishes the draft when there are no changes', done => {
      const draftForm = _.cloneDeep(form);
      draftForm._vid = 'draft';
      helper.updateForm(draftForm, (err, result) => {
        if (err) {
          return done(err);
        }
        helper.getFormRevisions(form, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 5);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 4);
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          assert.equal(result[4].components.length, 4);
          assert.equal(result[4]._vid, 5);
          assert.equal(result[4]._rid, form._id);
          assert.equal(result[4].name, form.name);
          assert(result[4].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });

    it('Validates a submission against version 1', done => {
      helper.createSubmission('revisionForm', {
        data: {},
        _fvid: 1
      }, helper.owner, [/application\/json/, 400], (err, result) => {
        assert.equal(result.name, 'ValidationError');
        assert.equal(result.details.length, 2);
        assert.equal(result.details[0].message, 'fname is required');
        assert.equal(result.details[0].context.validator, 'required');
        assert.equal(result.details[1].message, 'lname is required');
        assert.equal(result.details[1].context.validator, 'required');
        done();
      });
    });

    it('Validates a submission against version 2', done => {
      helper.createSubmission('revisionForm', {
        data: {},
        _fvid: 2
      }, helper.owner, [/application\/json/, 400], (err, result) => {
        assert.equal(result.name, 'ValidationError');
        assert.equal(result.details.length, 3);
        assert.equal(result.details[0].message, 'fname is required');
        assert.equal(result.details[0].context.validator, 'required');
        assert.equal(result.details[1].message, 'lname is required');
        assert.equal(result.details[1].context.validator, 'required');
        assert.equal(result.details[2].message, 'mname is required');
        assert.equal(result.details[2].context.validator, 'required');
        done();
      });
    });

    it('Validates a submission against version 3', done => {
      helper.createSubmission('revisionForm', {
        data: {},
        _fvid: 3
      }, helper.owner, [/application\/json/, 400], (err, result) => {
        assert.equal(result.name, 'ValidationError');
        assert.equal(result.details.length, 4);
        assert.equal(result.details[0].message, 'fname is required');
        assert.equal(result.details[0].context.validator, 'required');
        assert.equal(result.details[1].message, 'lname is required');
        assert.equal(result.details[1].context.validator, 'required');
        assert.equal(result.details[2].message, 'mname is required');
        assert.equal(result.details[2].context.validator, 'required');
        assert.equal(result.details[3].message, 'pname is required');
        assert.equal(result.details[3].context.validator, 'required');
        done();
      });
    });


    it('Submits to form version 2', done => {
      const data = {
        fname: 'joe',
        lname: 'test',
        mname: 'bob'
      };
      helper.createSubmission('revisionForm', {
        data,
        _fvid: 2
      }, (err, result) => {
        if (err) {
          done(err);
        }
        assert.equal(result._fvid, 2);
        assert.deepEqual(result.data, data);
        done();
      });
    });

    it('does not create a revision for basic plans', done => {
      form.components[0].prefix = 'basic';
      helper
        .plan('basic')
        .execute(() => {
          helper.updateForm(form, (err, result) => {
            if (err) {
              return done(err);
            }
            helper.getFormRevisions(form, (err, result) => {
              if (err) {
                return done(err);
              }
              assert.equal(result.length, 5);
              assert.equal(result[0].components.length, 2);
              assert.equal(result[0]._vid, 1);
              assert.equal(result[0]._rid, form._id);
              assert.equal(result[0].name, form.name);
              assert(result[0].hasOwnProperty('machineName') === false);
              assert.equal(result[1].components.length, 3);
              assert.equal(result[1]._vid, 2);
              assert.equal(result[1]._rid, form._id);
              assert.equal(result[1].name, form.name);
              assert(result[1].hasOwnProperty('machineName') === false);
              assert.equal(result[2].components.length, 4);
              assert.equal(result[2]._vid, 3);
              assert.equal(result[2]._rid, form._id);
              assert.equal(result[2].name, form.name);
              assert(result[2].hasOwnProperty('machineName') === false);
              assert.equal(result[3].components.length, 4);
              assert.equal(result[3]._vid, 4);
              assert.equal(result[3]._rid, form._id);
              assert.equal(result[3].name, form.name);
              assert(result[3].hasOwnProperty('machineName') === false);
              assert.equal(result[4].components.length, 4);
              assert.equal(result[4]._vid, 5);
              assert.equal(result[4]._rid, form._id);
              assert.equal(result[4].name, form.name);
              assert(result[4].hasOwnProperty('machineName') === false);
              done();
            });
          });
        });
    });

    it('does not save a draft for basic plans', done => {
      helper.putFormDraft(form, (err, result) => {
        assert.equal(result.status, 402);
        assert.equal(result.text, 'Payment Required. Project must be on an Enterprise plan.');
        done();
      });
    });

    it('does not create a revision for independent plans', done => {
      form.components[0].prefix = 'independent';
      helper
        .plan('independent')
        .execute(() => {
          helper.updateForm(form, (err, result) => {
            helper.getFormRevisions(result, (err, result) => {
              if (err) {
                return done(err);
              }
              assert.equal(result.length, 5);
              assert.equal(result[0].components.length, 2);
              assert.equal(result[0]._vid, 1);
              assert.equal(result[0]._rid, form._id);
              assert.equal(result[0].name, form.name);
              assert(result[0].hasOwnProperty('machineName') === false);
              assert.equal(result[1].components.length, 3);
              assert.equal(result[1]._vid, 2);
              assert.equal(result[1]._rid, form._id);
              assert.equal(result[1].name, form.name);
              assert(result[1].hasOwnProperty('machineName') === false);
              assert.equal(result[2].components.length, 4);
              assert.equal(result[2]._vid, 3);
              assert.equal(result[2]._rid, form._id);
              assert.equal(result[2].name, form.name);
              assert(result[2].hasOwnProperty('machineName') === false);
              assert.equal(result[3].components.length, 4);
              assert.equal(result[3]._vid, 4);
              assert.equal(result[3]._rid, form._id);
              assert.equal(result[3].name, form.name);
              assert(result[3].hasOwnProperty('machineName') === false);
              assert.equal(result[4].components.length, 4);
              assert.equal(result[4]._vid, 5);
              assert.equal(result[4]._rid, form._id);
              assert.equal(result[4].name, form.name);
              assert(result[4].hasOwnProperty('machineName') === false);
              done();
            });
          });
        });
    });

    it('does not save a draft for independent plans', done => {
      helper.putFormDraft(form, (err, result) => {
        assert.equal(result.status, 402);
        assert.equal(result.text, 'Payment Required. Project must be on an Enterprise plan.');
        done();
      });
    });

    it('does not create a revision for team pro plans', done => {
      form.components[0].prefix = 'team';
      helper
        .plan('team')
        .execute(() => {
          helper.updateForm(form, (err, result) => {
            helper.getFormRevisions(result, (err, result) => {
              if (err) {
                return done(err);
              }
              assert.equal(result.length, 5);
              assert.equal(result[0].components.length, 2);
              assert.equal(result[0]._vid, 1);
              assert.equal(result[0]._rid, form._id);
              assert.equal(result[0].name, form.name);
              assert(result[0].hasOwnProperty('machineName') === false);
              assert.equal(result[1].components.length, 3);
              assert.equal(result[1]._vid, 2);
              assert.equal(result[1]._rid, form._id);
              assert.equal(result[1].name, form.name);
              assert(result[1].hasOwnProperty('machineName') === false);
              assert.equal(result[2].components.length, 4);
              assert.equal(result[2]._vid, 3);
              assert.equal(result[2]._rid, form._id);
              assert.equal(result[2].name, form.name);
              assert(result[2].hasOwnProperty('machineName') === false);
              assert.equal(result[3].components.length, 4);
              assert.equal(result[3]._vid, 4);
              assert.equal(result[3]._rid, form._id);
              assert.equal(result[3].name, form.name);
              assert(result[3].hasOwnProperty('machineName') === false);
              assert.equal(result[4].components.length, 4);
              assert.equal(result[4]._vid, 5);
              assert.equal(result[4]._rid, form._id);
              assert.equal(result[4].name, form.name);
              assert(result[4].hasOwnProperty('machineName') === false);
              done();
            });
          });
        });
    });

    it('does not save a draft for team pro plans', done => {
      helper.putFormDraft(form, (err, result) => {
        assert.equal(result.status, 402);
        assert.equal(result.text, 'Payment Required. Project must be on an Enterprise plan.');
        done();
      });
    });

    it('creates a revision for commercial plans', done => {
      form.components[0].prefix = 'commercial';
      helper
        .plan('commercial')
        .execute(() => {
          helper.updateForm(form, (err, result) => {
            helper.getFormRevisions(result, (err, result) => {
              if (err) {
                return done(err);
              }
              assert.equal(result.length, 6);
              assert.equal(result[0].components.length, 2);
              assert.equal(result[0]._vid, 1);
              assert.equal(result[0]._rid, form._id);
              assert.equal(result[0].name, form.name);
              assert(result[0].hasOwnProperty('machineName') === false);
              assert.equal(result[1].components.length, 3);
              assert.equal(result[1]._vid, 2);
              assert.equal(result[1]._rid, form._id);
              assert.equal(result[1].name, form.name);
              assert(result[1].hasOwnProperty('machineName') === false);
              assert.equal(result[2].components.length, 4);
              assert.equal(result[2]._vid, 3);
              assert.equal(result[2]._rid, form._id);
              assert.equal(result[2].name, form.name);
              assert(result[2].hasOwnProperty('machineName') === false);
              assert.equal(result[3].components.length, 4);
              assert.equal(result[3]._vid, 4);
              assert.equal(result[3]._rid, form._id);
              assert.equal(result[3].name, form.name);
              assert(result[3].hasOwnProperty('machineName') === false);
              assert.equal(result[4].components.length, 4);
              assert.equal(result[4]._vid, 5);
              assert.equal(result[4]._rid, form._id);
              assert.equal(result[4].name, form.name);
              assert(result[4].hasOwnProperty('machineName') === false);
              assert.equal(result[5].components.length, 4);
              assert.equal(result[5]._vid, 6);
              assert.equal(result[5]._rid, form._id);
              assert.equal(result[5].name, form.name);
              assert(result[5].hasOwnProperty('machineName') === false);
              done();
            });
          });
        });
    });

    it('Sets a form to not use revisions', done => {
      form.revisions = '';
      helper.updateForm(form, (err, result) => {
        assert.equal(result.revisions, '');
        done();
      });
    });

    it('Does not create a new revision when a non-revision form is updated', done => {
      form.components.push({
        input: true,
        tableView: true,
        inputType: 'text',
        inputMask: '',
        label: 'dname',
        key: 'dname',
        placeholder: '',
        prefix: '',
        suffix: '',
        multiple: false,
        defaultValue: '',
        protected: false,
        unique: false,
        persistent: true,
        validate: {
          required: true,
          minLength: '',
          maxLength: '',
          pattern: '',
          custom: '',
          customPrivate: false
        },
        conditional: {
          show: '',
          when: null,
          eq: ''
        },
        type: 'textfield'
      });
      helper.updateForm(form, (err, result) => {
        helper.getFormRevisions(result, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.equal(result.length, 6);
          assert.equal(result[0].components.length, 2);
          assert.equal(result[0]._vid, 1);
          assert.equal(result[0]._rid, form._id);
          assert.equal(result[0].name, form.name);
          assert(result[0].hasOwnProperty('machineName') === false);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 4);
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          assert.equal(result[4].components.length, 4);
          assert.equal(result[4]._vid, 5);
          assert.equal(result[4]._rid, form._id);
          assert.equal(result[4].name, form.name);
          assert(result[4].hasOwnProperty('machineName') === false);
          assert.equal(result[5].components.length, 4);
          assert.equal(result[5]._vid, 6);
          assert.equal(result[5]._rid, form._id);
          assert.equal(result[5].name, form.name);
          assert(result[5].hasOwnProperty('machineName') === false);
          done();
        });
      });
    });
  });
};
