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
      helper.updateForm(form, (err, result) => {
        assert.equal(result.revisions, true);
        done();
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

    it('Sets a form to not use revisions', done => {
      form.revisions = false;
      helper.updateForm(form, (err, result) => {
        assert.equal(result.revisions, false);
        done();
      });
    });
  });
};