'use strict';
const assert = require('assert');

module.exports = (app, template, hook) => {
  let helper = new template.Helper(template.formio.owner);
  let form;
  describe('Form Submissions', () => {
    it('Creates a test project and form', done => {
      helper
        .project()
        .plan('trial')
        .form('submissionValidate', [
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
          form = helper.getForm('submissionValidate');
          assert(typeof form === 'object');
          done();
        });
    });

    it('Should allow a validation of a submission.', done => {
      helper.validateSubmission(form, {
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
  });
};
