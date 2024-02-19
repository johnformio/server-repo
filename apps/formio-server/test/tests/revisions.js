/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var util = require('formio/src/util/util');
const config = require('../../config');

module.exports = (app, template, hook) => {
  const helper = new template.Helper(template.formio.owner);
  let form;
  let revisionId;

  describe('Form Revisions', () => {
    before((done) => {
      process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'examplekey';
      process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
      done();
    });

    after((done) => {
      process.env.TEST_SIMULATE_SAC_PACKAGE = '0';
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
          assert.equal(result[0].revisionId, result[0]._id);
          done();
        });
      });
    });

    if (!config.formio.hosted) {
      it('Should not create a new revision if sac is disabled', done => {
        process.env.TEST_SIMULATE_SAC_PACKAGE = '0';
        form.components[0].tableView = false;
        helper.updateForm(form, (err, result) => {
          helper.getFormRevisions(result, (err, result) => {
            if (err) {
              process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
              return done(err);
            }
            // 1 revision is left from prev test
            assert.equal(result.length, 1);
            process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
            done();
          });
        });
      });
    }

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
          assert.equal(result[0].revisionId, result[0]._id);
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
          assert.equal(result[0].revisionId, result[0]._id);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert.equal(result[1].revisionId, result[1]._id);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert.equal(result[2].revisionId, result[2]._id);
          assert(result[2].hasOwnProperty('machineName') === false);
          revisionId = result[2].revisionId;
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
          assert.equal(result[0].revisionId, result[0]._id);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert.equal(result[1].revisionId, result[1]._id);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[2].revisionId, result[2]._id);
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

    it('Can access a revision by revisionId', done => {
      helper.getFormRevision(form, revisionId, (err, result) => {
        assert.equal(result.components.length, 4);
        assert.equal(result._vid, 3);
        assert.equal(result._rid, form._id);
        assert.equal(result.name, form.name);
        assert(result.hasOwnProperty('machineName') === false);
        done();
      });
    });

    it('Can access a revision by query parameter', done => {
     helper.getFormRevisionByQueryParam(form, 'formRevision=3', (err, result) => {
       if (err) {
        return done(err);
       }
       assert.equal(result.components.length, 4);
       assert.equal(result._vid, 3);
       assert.equal(result._rid, form._id);
       assert.equal(result.name, form.name);
       assert(result.hasOwnProperty('machineName') === false);
       done();
     });
    });

    it('Can access a revision by query parameter', done => {
      helper.getFormRevisionByQueryParam(form, `formRevision=${revisionId}`, (err, result) => {
        if (err) {
         return done(err);
        }
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

    it('Returns a 404 for a non-existent revision', done => {
      helper.getFormRevision(form, form._id, (err, result) => {
        assert.equal(result.status, 404);
        done();
      });
    });

    it('Can not access a non-existent revision by query parameter', done => {
      helper.getFormRevisionByQueryParam(form, 'formRevision=4', (err, result) => {
        assert.equal(result.status, 404);
        done();
      });
    });

    it('Can not access a non-existent revision by query parameter', done => {
      helper.getFormRevisionByQueryParam(form, `formRevision=${form._id}`, (err, result) => {
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
          assert.equal(result[0].revisionId, result[0]._id);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[1].revisionId, result[1]._id);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[2].revisionId, result[2]._id);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 4);
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          assert.equal(result[3].revisionId, result[3]._id);
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
          assert.equal(result[0].revisionId, result[0]._id);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[1].revisionId, result[1]._id);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[2].revisionId, result[2]._id);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 4);
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          assert.equal(result[3].revisionId, result[3]._id);
          assert.equal(result[4].components.length, 4);
          assert.equal(result[4]._vid, 5);
          assert.equal(result[4]._rid, form._id);
          assert.equal(result[4].name, form.name);
          assert(result[4].hasOwnProperty('machineName') === false);
          assert.equal(result[4].revisionId, result[4]._id);
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

    it('Validates a submission against revision id', done => {
      helper.createSubmission('revisionForm', {
        data: {},
        _fvid: revisionId
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

    if (config.formio.hosted) {
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
                assert.equal(result[0].revisionId, result[0]._id);
                assert.equal(result[1].components.length, 3);
                assert.equal(result[1]._vid, 2);
                assert.equal(result[1]._rid, form._id);
                assert.equal(result[1].name, form.name);
                assert(result[1].hasOwnProperty('machineName') === false);
                assert.equal(result[1].revisionId, result[1]._id);
                assert.equal(result[2].components.length, 4);
                assert.equal(result[2]._vid, 3);
                assert.equal(result[2]._rid, form._id);
                assert.equal(result[2].name, form.name);
                assert(result[2].hasOwnProperty('machineName') === false);
                assert.equal(result[2].revisionId, result[2]._id);
                assert.equal(result[3].components.length, 4);
                assert.equal(result[3]._vid, 4);
                assert.equal(result[3]._rid, form._id);
                assert.equal(result[3].name, form.name);
                assert(result[3].hasOwnProperty('machineName') === false);
                assert.equal(result[3].revisionId, result[3]._id);
                assert.equal(result[4].components.length, 4);
                assert.equal(result[4]._vid, 5);
                assert.equal(result[4]._rid, form._id);
                assert.equal(result[4].name, form.name);
                assert(result[4].hasOwnProperty('machineName') === false);
                assert.equal(result[4].revisionId, result[4]._id);
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
                assert.equal(result[0].revisionId, result[0]._id);
                assert.equal(result[1].components.length, 3);
                assert.equal(result[1]._vid, 2);
                assert.equal(result[1]._rid, form._id);
                assert.equal(result[1].name, form.name);
                assert(result[1].hasOwnProperty('machineName') === false);
                assert.equal(result[1].revisionId, result[1]._id);
                assert.equal(result[2].components.length, 4);
                assert.equal(result[2]._vid, 3);
                assert.equal(result[2]._rid, form._id);
                assert.equal(result[2].name, form.name);
                assert(result[2].hasOwnProperty('machineName') === false);
                assert.equal(result[2].revisionId, result[2]._id);
                assert.equal(result[3].components.length, 4);
                assert.equal(result[3]._vid, 4);
                assert.equal(result[3]._rid, form._id);
                assert.equal(result[3].name, form.name);
                assert(result[3].hasOwnProperty('machineName') === false);
                assert.equal(result[3].revisionId, result[3]._id);
                assert.equal(result[4].components.length, 4);
                assert.equal(result[4]._vid, 5);
                assert.equal(result[4]._rid, form._id);
                assert.equal(result[4].name, form.name);
                assert(result[4].hasOwnProperty('machineName') === false);
                assert.equal(result[4].revisionId, result[4]._id);
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
                assert.equal(result[0].revisionId, result[0]._id);
                assert.equal(result[1].components.length, 3);
                assert.equal(result[1]._vid, 2);
                assert.equal(result[1]._rid, form._id);
                assert.equal(result[1].name, form.name);
                assert(result[1].hasOwnProperty('machineName') === false);
                assert.equal(result[1].revisionId, result[1]._id);
                assert.equal(result[2].components.length, 4);
                assert.equal(result[2]._vid, 3);
                assert.equal(result[2]._rid, form._id);
                assert.equal(result[2].name, form.name);
                assert(result[2].hasOwnProperty('machineName') === false);
                assert.equal(result[2].revisionId, result[2]._id);
                assert.equal(result[3].components.length, 4);
                assert.equal(result[3]._vid, 4);
                assert.equal(result[3]._rid, form._id);
                assert.equal(result[3].name, form.name);
                assert(result[3].hasOwnProperty('machineName') === false);
                assert.equal(result[3].revisionId, result[3]._id);
                assert.equal(result[4].components.length, 4);
                assert.equal(result[4]._vid, 5);
                assert.equal(result[4]._rid, form._id);
                assert.equal(result[4].name, form.name);
                assert(result[4].hasOwnProperty('machineName') === false);
                assert.equal(result[4].revisionId, result[4]._id);
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
    }

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
              assert.equal(result[0].revisionId, result[0]._id);
              assert.equal(result[1].components.length, 3);
              assert.equal(result[1]._vid, 2);
              assert.equal(result[1]._rid, form._id);
              assert.equal(result[1].name, form.name);
              assert(result[1].hasOwnProperty('machineName') === false);
              assert.equal(result[1].revisionId, result[1]._id);
              assert.equal(result[2].components.length, 4);
              assert.equal(result[2]._vid, 3);
              assert.equal(result[2]._rid, form._id);
              assert.equal(result[2].name, form.name);
              assert(result[2].hasOwnProperty('machineName') === false);
              assert.equal(result[2].revisionId, result[2]._id);
              assert.equal(result[3].components.length, 4);
              assert.equal(result[3]._vid, 4);
              assert.equal(result[3]._rid, form._id);
              assert.equal(result[3].name, form.name);
              assert(result[3].hasOwnProperty('machineName') === false);
              assert.equal(result[3].revisionId, result[3]._id);
              assert.equal(result[4].components.length, 4);
              assert.equal(result[4]._vid, 5);
              assert.equal(result[4]._rid, form._id);
              assert.equal(result[4].name, form.name);
              assert(result[4].hasOwnProperty('machineName') === false);
              assert.equal(result[4].revisionId, result[4]._id);
              assert.equal(result[5].components.length, 4);
              assert.equal(result[5]._vid, 6);
              assert.equal(result[5]._rid, form._id);
              assert.equal(result[5].name, form.name);
              assert(result[5].hasOwnProperty('machineName') === false);
              assert.equal(result[5].revisionId, result[5]._id);
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
          assert.equal(result[0].revisionId, result[0]._id);
          assert.equal(result[1].components.length, 3);
          assert.equal(result[1]._vid, 2);
          assert.equal(result[1]._rid, form._id);
          assert.equal(result[1].name, form.name);
          assert(result[1].hasOwnProperty('machineName') === false);
          assert.equal(result[1].revisionId, result[1]._id);
          assert.equal(result[2].components.length, 4);
          assert.equal(result[2]._vid, 3);
          assert.equal(result[2]._rid, form._id);
          assert.equal(result[2].name, form.name);
          assert(result[2].hasOwnProperty('machineName') === false);
          assert.equal(result[2].revisionId, result[2]._id);
          assert.equal(result[3].components.length, 4);
          assert.equal(result[3]._vid, 4);
          assert.equal(result[3]._rid, form._id);
          assert.equal(result[3].name, form.name);
          assert(result[3].hasOwnProperty('machineName') === false);
          assert.equal(result[3].revisionId, result[3]._id);
          assert.equal(result[4].components.length, 4);
          assert.equal(result[4]._vid, 5);
          assert.equal(result[4]._rid, form._id);
          assert.equal(result[4].name, form.name);
          assert(result[4].hasOwnProperty('machineName') === false);
          assert.equal(result[4].revisionId, result[4]._id);
          assert.equal(result[5].components.length, 4);
          assert.equal(result[5]._vid, 6);
          assert.equal(result[5]._rid, form._id);
          assert.equal(result[5].name, form.name);
          assert(result[5].hasOwnProperty('machineName') === false);
          assert.equal(result[5].revisionId, result[5]._id);
          done();
        });
      });
    });
  });

  describe('Submission Revisions', () => {
   // const helper = new template.Helper(template.formio.owner);
    let form;
    let formWithInitiallyDisabledRevision;
    let submissionRevisionChangelogForm;
    let submission;
    let submissionWithInitiallyDisabledRevision;
    const data = {
      fname: 'joe',
      lname: 'test'
    };
    let submissionRevisions;

    before((done) => {
      process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'examplekey';
      process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
      done();
    });

    after((done) => {
      process.env.TEST_SIMULATE_SAC_PACKAGE = '0';
      done();
    });

    it('Creates a test project and form', done => {
      helper
        .project()
        .plan('trial')
        .form('submissionRevisionForm', [
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
        .form('submissionRevisionUpdateForm', [
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
        .form('submissionRevisionChangelogForm', [
          {
            input: true,
            tableView: false,
            inputFormat: 'plain',
            label: 'number1',
            key: 'number1',
            requireDecimal: false,
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
            type: 'number',
          },
          {
            input: true,
            tableView: false,
            inputFormat: 'plain',
            label: 'number2',
            key: 'number2',
            requireDecimal: false,
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
            type: 'number',
          }
        ])
        .execute(function() {
          form = helper.getForm('submissionRevisionForm');
          formWithInitiallyDisabledRevision = helper.getForm('submissionRevisionUpdateForm');
          submissionRevisionChangelogForm = helper.getForm('submissionRevisionChangelogForm');
          assert(typeof form === 'object');
          assert(typeof formWithInitiallyDisabledRevision === 'object');
          assert(typeof submissionRevisionChangelogForm === 'object');
          done();
        });
    });

    it('Create submission with disabled revisions', done => {
      helper.createSubmission('submissionRevisionUpdateForm', {
        data,
      },
      (err, result) => {
        if (err) {
          return done(err);
        }
        submissionWithInitiallyDisabledRevision = result;
        assert.deepEqual(submissionWithInitiallyDisabledRevision.data, data);
        assert.deepEqual(submissionWithInitiallyDisabledRevision.containRevisions, undefined);
        helper.getSubmissionRevisions(formWithInitiallyDisabledRevision, submissionWithInitiallyDisabledRevision,
        (err, revisions) => {
          if (err) {
            return done(err);
          }
          assert.equal(revisions.length, 0);
          done();
        });
      });
    });

    it('Sets a form with submissions to use submission revisions', done => {
      formWithInitiallyDisabledRevision.submissionRevisions = 'true';
      formWithInitiallyDisabledRevision.components.push();
      helper.updateForm(formWithInitiallyDisabledRevision, (err, result) => {
        assert.equal(result.submissionRevisions, 'true');
        helper.getSubmissionRevisions(formWithInitiallyDisabledRevision, submissionWithInitiallyDisabledRevision,
          (err, revisions) => {
            if (err) {
              return done(err);
            }

            assert.equal(revisions.length, 1);
            assert.equal(revisions[0]._rid, submissionWithInitiallyDisabledRevision._id);
            assert.equal(revisions[0]._vuser, helper.owner.data.email);
            assert.deepEqual(revisions[0].data, data);
            assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/fname', value: 'joe'});
            assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lname', value: 'test'});
            helper.getSubmission('submissionRevisionUpdateForm', submissionWithInitiallyDisabledRevision._id,
              (err, result) => {
                if (err) {
                  return done(err);
                }
                submissionWithInitiallyDisabledRevision = result;
                assert.deepEqual(submissionWithInitiallyDisabledRevision.containRevisions, true);
                done();
              });
          });
      });
    });

    it('Disable submission revisions on form', done => {
      formWithInitiallyDisabledRevision.submissionRevisions = 'false';
      formWithInitiallyDisabledRevision.components.push();
      helper.updateForm(formWithInitiallyDisabledRevision, (err, result) => {
        assert.equal(result.submissionRevisions, 'false');
        done();
      });
    });

    if (config.formio.hosted) {
      it('Sets a form to use submission revisions', done => {
        form.submissionRevisions = 'true';
        form.components.push();
        helper.updateForm(form, (err, result) => {
          assert.equal(result.submissionRevisions, 'true');
          done();
        });
      });

      it('Should not create revisions in hosted env if submission revisions are enabled', done => {
        helper.createSubmission('submissionRevisionForm', {
          data,
        },
        (err, result) => {
          if (err) {
            return done(err);
          }
          submission = result;
          assert.deepEqual(submission.data, data);
          assert.deepEqual(!!submission.containRevisions, false);
          helper.getSubmissionRevisions(form, submission,
          (err, revisions) => {
            if (err) {
             return  done(err);
            }
            assert.equal(revisions.length, 0);
            done();
          });
        });
      });
    }

    if (!config.formio.hosted) {
      it('Update submission with disabled revisions', done => {
        const nawData = {
          fname: 'joe1',
          lname: 'test1'
        };
        submissionWithInitiallyDisabledRevision.data = nawData;
        helper.updateSubmission( submissionWithInitiallyDisabledRevision,
          (err, result) => {
            if (err) {
              return done(err);
            }
            submissionWithInitiallyDisabledRevision = result;
            assert.deepEqual(submissionWithInitiallyDisabledRevision.data, nawData);
            assert.deepEqual(submissionWithInitiallyDisabledRevision.containRevisions, true);
            helper.getSubmissionRevisions(formWithInitiallyDisabledRevision, submissionWithInitiallyDisabledRevision,
            (err, revisions) => {
              if (err) {
                return done(err);
              }
              assert.equal(revisions.length, 2);
              assert.equal(revisions[0]._rid, submissionWithInitiallyDisabledRevision._id);
              assert.equal(revisions[0]._vuser, helper.owner.data.email);
              assert.deepEqual(revisions[0].data, data);
              assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/fname', value: 'joe'});
              assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lname', value: 'test'});

              assert.equal(revisions[1]._rid, submissionWithInitiallyDisabledRevision._id);
              assert.equal(revisions[1]._vuser, helper.owner.data.email);
              assert.deepEqual(revisions[1].data, nawData);
              assert.deepEqual(revisions[1].metadata.jsonPatch[1], {op: 'replace', path: '/data/fname', value: 'joe1'});
              assert.deepEqual(revisions[1].metadata.jsonPatch[0], {op: 'replace', path: '/data/lname', value: 'test1'});

              done();
            });
          });
      });

      it('Sets a form to use submission revisions', done => {
        form.submissionRevisions = 'true';
        form.components.push();
        helper.updateForm(form, (err, result) => {
          assert.equal(result.submissionRevisions, 'true');
          done();
        });
      });

      it('Does not Create submission with wrong data', done => {
        helper.createSubmission('submissionRevisionForm', {
          data: {},
        }, helper.owner, [/application\/json/, 400], (err, result) => {
          assert.equal(result.name, 'ValidationError');
          done();
        });
      });

      it('Create submission with enabled revisions', done => {
        helper.createSubmission('submissionRevisionForm', {
          data,
        },
        (err, result) => {
          if (err) {
            return done(err);
          }
          submission = result;
          assert.deepEqual(submission.data, data);
          assert.deepEqual(submission.containRevisions, true);
          helper.getSubmissionRevisions(form, submission,
          (err, revisions) => {
            if (err) {
              return done(err);
            }

            assert.equal(revisions.length, 1);
            assert.equal(revisions[0]._rid, submission._id);
            assert.equal(revisions[0]._vuser, helper.owner.data.email);
            assert.deepEqual(revisions[0].data, data);
            assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/fname', value: 'joe'});
            assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lname', value: 'test'});
            submissionRevisions = revisions;

            done();
          });
        });
      });

      it('Does not Create a new revision without update data', done => {
        helper.updateSubmission(submission,
        (err, result) => {
          if (err) {
            return done(err);
          }
          helper.getSubmissionRevisions(form, submission, (err, revisions) => {
            if (err) {
              return done(err);
            }

            assert.equal(revisions.length, 1);
            assert.equal(revisions[0]._rid, submission._id);
            assert.equal(revisions[0]._vuser, helper.owner.data.email);
            assert.deepEqual(revisions[0].data, data);
            assert.equal(revisions[0].metadata.jsonPatch.length, 2);
            assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/fname', value: 'joe'});
            assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lname', value: 'test'});

            done();
          });
        });
      });

      it('Create a new revision when update data', done => {
        submission.data.fname = 'Joe';
        submission._vnote = 'vnote';
        helper.updateSubmission(submission,
        (err, result) => {
          if (err) {
            return done(err);
          }
          helper.getSubmissionRevisions(form, submission, (err, revisions) => {
            if (err) {
              return done(err);
            }

            assert.equal(revisions.length, 2);
            assert.equal(revisions[0]._rid, submission._id);
            assert.equal(revisions[0]._vuser, helper.owner.data.email);
            assert.deepEqual(revisions[0].data, data);
            assert.equal(revisions[0].metadata.jsonPatch.length, 2);
            assert.deepEqual(revisions[0].metadata.jsonPatch[1], {op: 'add', path: '/data/lname', value: 'test'});
            assert.deepEqual(revisions[0].metadata.jsonPatch[0], {op: 'add', path: '/data/fname', value: 'joe'});

            assert.equal(revisions[1]._rid, submission._id);
            assert.equal(revisions[1]._vuser, helper.owner.data.email);
            assert.deepEqual(revisions[1].data, {fname: 'Joe', lname: data.lname});
            assert.equal(revisions[1].metadata.jsonPatch.length, 1);
            assert.deepEqual(revisions[1].metadata.jsonPatch[0], {op: 'replace', path: '/data/fname', value: 'Joe'});
            assert.deepEqual(revisions[1].metadata.previousData, data);
            assert.equal(revisions[1]._vnote, 'vnote');

            submissionRevisions = revisions;

            done();
          });
        });
      });

      it('Does not Create a new revision when sac is disabled', done => {
        process.env.TEST_SIMULATE_SAC_PACKAGE = '0';
        submission.data.fname = 'Tom';
        helper.updateSubmission(submission,
        (err, result) => {
          if (err) {
            return done(err);
          }
          helper.getSubmissionRevisions(form, submission, (err, revisions) => {
            if (err) {
              return done(err);
            }

            assert.equal(revisions.length, 2);
            process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
            done();
          });
        });
      });

      it('Should not be able to get changelog when sac is disabled', done => {
        process.env.TEST_SIMULATE_SAC_PACKAGE = '0';
        request(app)
          .get(`/project/${helper.template.project._id}/form/${form._id}/submission/${submission._id}/changelog`)
          .send()
          .set('x-jwt-token', helper.owner.token)
          .expect('Content-Type', /text\/plain/)
          .expect(403)
          .end((err, res) => {
            if (err) {
              process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
              return done(err);
            }
            process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
            done();
          });
      });

      it('Get submission revision by Id', done => {
        helper.getSubmissionRevision(form, submission, submissionRevisions[1]._id, (err, result) => {
          if (err) {
            return done(err);
          }

          assert.equal(result._rid, submission._id);
          assert.equal(result._vuser, helper.owner.data.email);
          assert.deepEqual(result.data, {fname: 'Joe', lname: data.lname});
          assert.equal(result.metadata.jsonPatch.length, 1);
          assert.deepEqual(result.metadata.jsonPatch[0], {op: 'replace', path: '/data/fname', value: 'Joe'});
          assert.deepEqual(result.metadata.previousData, data);
          assert.equal(result._vnote, 'vnote');

          done();
        });
      });

      it('Get submission change log', done => {
        helper.getSubmissionChangeLog(form, submission, (err, results) => {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 2);

          const revision0 = results.find((revision)=> revision._id === submissionRevisions[0]._id);
          const revision1 = results.find((revision)=> revision._id === submissionRevisions[1]._id);

          assert.equal(revision0._vuser, submissionRevisions[0]._vuser);
          assert.deepEqual(revision0.data, submissionRevisions[0].data);
          assert.equal(revision0.metadata.jsonPatch.length, submissionRevisions[0].metadata.jsonPatch.length);
          assert.deepEqual(revision0.metadata.jsonPatch[0], submissionRevisions[0].metadata.jsonPatch[0]);
          assert.deepEqual(revision0.metadata.jsonPatch[1], submissionRevisions[0].metadata.jsonPatch[1]);

          assert.equal(revision1._vuser, submissionRevisions[1]._vuser);
          assert.deepEqual(revision1.data, submissionRevisions[1].data);
          assert.equal(revision1.metadata.jsonPatch.length, submissionRevisions[1].metadata.jsonPatch.length);
          assert.deepEqual(revision1.metadata.jsonPatch[0], submissionRevisions[1].metadata.jsonPatch[0]);
          assert.deepEqual(revision1.metadata.previousData, submissionRevisions[1].metadata.previousData);

          done();
        });
      });

      it('Get submission revision change log', done => {
        helper.getSubmissionRevisionChangeLog(form, submission, submissionRevisions[1]._id, (err, result) => {
          if (err) {
            return done(err);
          }

          assert.equal(result._id, submissionRevisions[1]._id);
          assert.equal(result._vuser, submissionRevisions[1]._vuser);
          assert.deepEqual(result.data, submissionRevisions[1].data);
          assert.equal(result.metadata.jsonPatch.length, submissionRevisions[1].metadata.jsonPatch.length);
          assert.deepEqual(result.metadata.jsonPatch[0], submissionRevisions[1].metadata.jsonPatch[0]);
          assert.deepEqual(result.metadata.previousData, submissionRevisions[1].metadata.previousData);

          done();
        });
      });

      it('0 is shown in the Submission Revisions Changelog', done => {
        submissionRevisionChangelogForm.submissionRevisions = 'true';
        submissionRevisionChangelogForm.components.push();
        helper.updateForm(submissionRevisionChangelogForm, (err, result) => {
          assert.equal(result.submissionRevisions, 'true');
          const data = {
            number1: 0,
            number2: 25,
          }
          helper.createSubmission('submissionRevisionChangelogForm', {
            data
          }, (err, result) => {
            if (err) {
              return done(err);
            }
            submission = result;
            assert.deepEqual(submission.data, data);
            assert.deepEqual(submission.containRevisions, true);
            submission.data.number1 = 80;
            submission.data.number2 = 0;
            helper.updateSubmission(submission,
            (err, res) => {
              if (err) {
                return done(err);
              }
              submission = res;
              helper.getSubmissionRevisions(submissionRevisionChangelogForm, submission,
              (err, revisions) => {
                if (err) {
                  return done(err);
                }
                helper.getSubmissionRevisionChangeLog(submissionRevisionChangelogForm, submission, revisions[1]._id,
                  (err, results) => {
                    if (err) { 
                      return done(err); 
                    }
                    assert.equal(results.data.number2, 0);
                    assert.equal(results.metadata.previousData.number1, 0);
                    done();
                  });
              });
            });
          });
        });
      });
    }
  });
};
