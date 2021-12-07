/**/'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();
var sinon = require('sinon');

module.exports = (app, template, hook) => {
  let helper = new template.Helper(template.formio.owner);
  let form, submission;

  describe('Submission States', () => {
    it('Creates a test project and form', done => {
      helper
        .project()
        .plan('trial')
        .form('stateForm', [
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
        .execute(function () {
          form = helper.getForm('stateForm');
          assert(typeof form === 'object');
          done();
        });
    });

    it('Submitting without a state results in submitted', done => {
      helper.createSubmission('stateForm', {
        data: {
          fname: 'Joe',
          lname: 'Dirt'
        }
      }, (err, result) => {
        assert.equal(result.state, 'submitted');
        assert(result.hasOwnProperty('_id'));
        assert.deepEqual(result.data, {fname: 'Joe', lname: 'Dirt'});
        done();
      });
    });

    it('Allows saving without validation when in draft', done => {
      helper.createSubmission('stateForm', {
        state: 'draft',
        data: {
          fname: 'Test'
        }
      }, (err, result) => {
        assert.equal(result.state, 'draft');
        assert(result.hasOwnProperty('_id'));
        assert.deepEqual(result.data, {fname: 'Test'});
        submission = helper.getLastSubmission();
        done();
      });
    });

    it('Allows patch without validation when in draft', done => {
      helper.patchSubmission(submission,
        [{
          "op": "remove",
          "path": "/data/fname",
          }]
      , (err, result) => {
        assert.equal(result.state, 'draft');
        assert(result.hasOwnProperty('_id'));
        assert.deepEqual(result.data, {});
        submission = helper.getLastSubmission();
        done();
      });
    });

    it('Allows patch when in draft', done => {
      helper.patchSubmission(submission,
        [{
          "op": "add",
          "path": "/data/fname",
          "value": "Test"
          }]
      , (err, result) => {
        assert.equal(result.state, 'draft');
        assert(result.hasOwnProperty('_id'));
        assert.deepEqual(result.data, {fname: 'Test'});
        submission = helper.getLastSubmission();
        done();
      });
    });

    it('Throws an error when updating a submission from draft to submitted if validation fails', done => {
      submission.state = 'submitted';
      helper.updateSubmission(submission, helper.owner, [/application\/json/, 400], (err, result) => {
        assert(result.name === 'ValidationError', 'Returns an error');
        assert.equal(result.details[0].message, 'lname is required');
        done();
      });
    });

    it('Allows changing from draft to submitted if validation succeeds', done => {
      submission.state = 'submitted';
      submission.data.lname = 'Last';
      helper.updateSubmission(submission, (err, result) => {
        assert.equal(result.state, 'submitted');
        assert(result.hasOwnProperty('_id'));
        assert.deepEqual(result.data, {fname: 'Test', lname: 'Last'});
        done();
      });
    });

    it('Allows patch submission', done => {
      helper.patchSubmission(submission,
        [{
          "op": "replace",
          "path": "/data/fname",
          "value": "Test1"
          }]
      , (err, result) => {
        assert.equal(result.state, 'submitted');
        assert(result.hasOwnProperty('_id'));
        assert.deepEqual(result.data, {fname: 'Test1', lname: 'Last'});
        done();
      });
    });

    it('Patch submission with validation when submitted', done => {
      helper.patchSubmission(submission,
        [{
          "op": "remove",
          "path": "/data/fname",
          }],
      helper.owner, [/application\/json/, 400],
      (err, result) => {
        assert.equal(result.name, 'ValidationError');
        done();
      });
    });
  });
};
