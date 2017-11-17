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
              required: false,
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
              required: false,
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

    it('Sets a form to use revisions', done => {
      form.revisions = true;
      form.components.push();
      helper.updateForm(form, (err, result) => {
        assert.equal(result.revisions, true);
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
          required: false,
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
          required: false,
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

    it('It does not create a revision for basic plans', done => {
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

    it('It does not create a revision for independent plans', done => {
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

    it('It does not create a revision for team pro plans', done => {
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

    it('It creates a revision for commercial plans', done => {
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
      form.revisions = false;
      helper.updateForm(form, (err, result) => {
        assert.equal(result.revisions, false);
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
          required: false,
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