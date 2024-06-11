'use strict';

const request = require('supertest');
const assert = require('assert');
const sinon = require('sinon');
const Promise = require('bluebird');
const getTranslations = require('../../src/util/getTranslations');

module.exports = (app, template) => {
  describe('PDF Utils', () => {
    describe('getTranslations', () => {
      describe('Functional testing of getTranslations', () => {
        let req, formio, getTranslationsFunc, form;

        beforeEach(() => {
          req = {
            query: {},
            params: {projectId: 'testProjectId'},
          };
          formio = {
            resources: {
              form: {
                model: {
                  findOne: sinon.stub(),
                },
              },
              submission: {
                model: {
                  findOne: sinon.stub(),
                },
              },
            },
            util: {
              idToBson: sinon.stub().returns('bsonId'),
            },
          };
          getTranslationsFunc = getTranslations({formio});
          form = {
            settings: {
              translation: {},
            },
          };
          sinon.stub(Promise, 'promisify').callsFake((fn) => fn);
        });

        afterEach(() => {
          sinon.restore();
        });

        it('Should return null if no language code', async () => {
          req.query = {}; // No language code provided
          const result = await getTranslationsFunc(req, form);
          assert.equal(result, null);
        });

        it('Should return null if no form found', async () => {
          req.query = {language: 'en'}; // Language code provided
          formio.resources.form.model.findOne.returns(null);
          const result = await getTranslationsFunc(req, form);
          assert.equal(result, null);
        });

        it('Should return translation if found', async () => {
          form.settings.translation = {defaultCode: 'en'}; // Language code provided
          formio.resources.form.model.findOne.returns({_id: 'formId'});
          formio.resources.submission.model.findOne.returns({
            data: {translation: 'translation'},
          });
          const result = await getTranslationsFunc(req, form);
          assert.equal(result, 'translation');
        });

        it('Should return null if error thrown', async () => {
          formio.resources.form.model.findOne.throws();
          const result = await getTranslationsFunc(req, form);
          assert.equal(result, null);
        });

        it('Should use form settings when query params are not provided', async () => {
          // Clear the query params
          req.query = {};

          // Set the form settings
          form.settings.translation = {
            defaultCode: 'en',
            resource: 'resource1',
            languageComponent: 'lcomponent1',
            translationsComponent: 'tcomponent1',
          };

          // Set up the stubs
          formio.resources.form.model.findOne.returns({_id: 'formId'});
          formio.resources.submission.model.findOne
            .withArgs(
              sinon.match({
                form: 'formId',
                'data.lcomponent1': 'en',
              }),
              sinon.match({
                'data.tcomponent1': 1,
              }),
            )
            .returns({data: {tcomponent1: 'translation1'}});

          // Default return value
          formio.resources.submission.model.findOne.returns({
            data: {tcomponent1: 'defaultTranslation'},
          });

          // Call the function and check the result
          const result = await getTranslationsFunc(req, form);
          assert.equal(result, 'translation1');
        });

        it('Should override form settings with query params', async () => {
          // Clear the query params
          req.query = {};

          // Default translation resource in form settings
          form.settings.translation = {
            defaultCode: 'en',
            resource: 'resource1',
            languageComponent: 'lcomponent1',
            translationsComponent: 'tcomponent1',
          };

          // Set up the stubs
          formio.resources.form.model.findOne.returns({_id: 'formId'});
          formio.resources.submission.model.findOne
            .withArgs(
              sinon.match({
                form: 'formId',
                'data.lcomponent1': 'en',
              }),
              sinon.match({
                'data.tcomponent1': 1,
              }),
            )
            .returns({data: {tcomponent1: 'translation1'}});

          formio.resources.submission.model.findOne
            .withArgs(
              sinon.match({
                form: 'formId',
                'data.lcomponent2': 'sp',
              }),
              sinon.match({
                'data.tcomponent2': 1,
              }),
            )
            .returns({data: {tcomponent2: 'translation2'}});

          // Default return value
          formio.resources.submission.model.findOne.returns({
            data: {tcomponent1: 'defaultTranslation'},
          });

          let result = await getTranslationsFunc(req, form);
          assert.equal(result, 'translation1');

          // Translation resource provided in query params
          req.query = {
            language: 'sp',
            translationResource: 'resource2',
            languageComponent: 'lcomponent2',
            translationsComponent: 'tcomponent2',
          };

          result = await getTranslationsFunc(req, form);
          assert.equal(result, 'translation2');
        });
      });

      describe('Unit testing of getTranslations', () => {
        const formio = app.formio.formio;
        const helper = new template.Helper(template.formio.owner);
        it('Should create all necessary resources', (done) => {
          helper
            .project()
            // .token(template.token.owner)
            .plan('trial')
            .form({
              name: 'language',
              type: 'resource',
              components: [
                {
                  key: 'language',
                  label: 'Language',
                  type: 'select',
                  input: true,
                  widget: 'choicesjs',
                  data: {
                    values: [{label: 'Spanish', value: 'sp'}],
                  },
                },
                {
                  key: 'translation',
                  label: 'Translation',
                  type: 'datamap',
                  input: true,
                  valueComponent: {
                    type: 'textfield',
                    key: 'value',
                    label: 'Value',
                    input: true,
                    hideLabel: true,
                  },
                },
              ],
              submissionAccess: [
                {
                  type: 'read_all',
                  roles: ['anonymous'],
                },
              ],
            })
            .submission('language', {
              data: {
                language: 'sp',
                translation: {
                  key1: 'value1',
                  key2: 'value2',
                },
              },
            })
            .form({
              name: 'customLanguage',
              type: 'resource',
              components: [
                {
                  key: 'customLanguage',
                  label: 'Custom Language',
                  type: 'select',
                  input: true,
                  widget: 'choicesjs',
                  data: {
                    values: [{label: 'Spanish', value: 'sp'}],
                  },
                },
                {
                  key: 'customTranslation',
                  label: 'Custom Translation',
                  type: 'datamap',
                  input: true,
                  valueComponent: {
                    type: 'textfield',
                    key: 'value',
                    label: 'Value',
                    input: true,
                    hideLabel: true,
                  },
                },
              ],
              submissionAccess: [
                {
                  type: 'read_all',
                  roles: ['anonymous'],
                },
              ],
            })
            .submission('customLanguage', {
              data: {
                customLanguage: 'sp',
                customTranslation: {
                  key1: 'customValue1',
                  key2: 'customValue2',
                },
              },
            })
            .execute(done);
        });

        it('Should have added the anonymous role to the language form', (done) => {
          request(app)
            .get(`/project/${helper.template.project._id}/language`)
            .set('x-jwt-token', helper.owner.token)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }

              assert.equal(res.body.submissionAccess.length, 1);
              assert.equal(res.body.submissionAccess[0].type, 'read_all');
              assert.deepEqual(res.body.submissionAccess[0].roles, [
                helper.template.roles.anonymous._id,
              ]);
              done();
            });
        });

        it('Should return null if no code provided', async () => {
          const result = await getTranslations({formio})({query: {}}, {});
          assert.equal(result, null);
        });

        it('Should return null if no resource found', async () => {
          const form = {
            settings: {translation: {defaultCode: 'en', resource: 'fakeId'}},
          };
          const result = await getTranslations({formio})(
            {query: {}, params: {projectId: helper.template.project._id}},
            form,
          );
          assert.equal(result, null);
        });

        it('Should return null if no submission found', async () => {
          const form = {
            settings: {
              translation: {
                defaultCode: 'en',
                resource: helper.template.forms.language._id,
                languageComponent: 'language',
                translationsComponent: 'translation',
              },
            },
          };
          const result = await getTranslations({formio})(
            {
              query: {language: 'en'},
              params: {projectId: helper.template.project._id},
            },
            form,
          );
          assert.equal(result, null);
        });

        it('Should return translation by default params', async () => {
          const form = {settings: {translation: {defaultCode: 'sp'}}};
          const result = await getTranslations({formio})(
            {query: {}, params: {projectId: helper.template.project._id}},
            form,
          );
          assert.deepEqual(result, {key1: 'value1', key2: 'value2'});
        });

        it('Should return custom translation by form settings', async () => {
          let form = {
            settings: {
              translation: {
                defaultCode: 'sp',
                resource: helper.template.forms.language._id,
                languageComponent: 'language',
                translationsComponent: 'translation',
              },
            },
          };
          let result = await getTranslations({formio})(
            {query: {}, params: {projectId: helper.template.project._id}},
            form,
          );
          assert.deepEqual(result, {key1: 'value1', key2: 'value2'});
          form = {
            settings: {
              translation: {
                defaultCode: 'sp',
                resource: helper.template.forms.customLanguage._id,
                languageComponent: 'customLanguage',
                translationsComponent: 'customTranslation',
              },
            },
          };
          result = await getTranslations({formio})(
            {query: {}, params: {projectId: helper.template.project._id}},
            form,
          );
          assert.deepEqual(result, {
            key1: 'customValue1',
            key2: 'customValue2',
          });
        });

        it('Should return custom translation by query params', async () => {
          const form = {
            settings: {
              translation: {
                defaultCode: 'sp',
                resource: helper.template.forms.language._id,
                languageComponent: 'language',
                translationsComponent: 'translation',
              },
            },
          };
          const result = await getTranslations({formio})(
            {
              query: {
                language: 'sp',
                translationResource: helper.template.forms.customLanguage._id,
                languageComponent: 'customLanguage',
                translationsComponent: 'customTranslation',
              },
              params: {projectId: helper.template.project._id},
            },
            form,
          );
          assert.deepEqual(result, {
            key1: 'customValue1',
            key2: 'customValue2',
          });
        });
      });
    });
  });
};
