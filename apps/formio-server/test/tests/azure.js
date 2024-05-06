/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const _ = require('lodash');
const sinon = require('sinon');
const storage = require('@azure/storage-blob');
const { storages } = require('../../src/storage');
const azureStorage = storages.azure;

module.exports = function(app, template, hook) {
  describe('Azure Tests', () => {
    before(() => {
      process.env.ADMIN_KEY = 'examplekey';
    });

    describe('Azure setup', () => {
      it('Updates the project settings with Azure information', (done) => {
        const newSettings = {
          cors: '*',
          storage: {
            azure: {
              connectionString: 'fakeConnectionString',
              expiration: '900',
              container: 'test-container',
            },
          },
        };

        request(app)
          .put('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .send({settings: newSettings})
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.hasOwnProperty('settings'), true);
            assert.deepEqual(_.omit(response.settings, ['licenseKey']), newSettings);

            template.project = response;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            done();
          });
      });
    });

    describe('Email Actions', () => {
      describe('Exceptions', () => {
        let file;
        before(() => {
          file = { name: 'fakeName' };
        });

        it('Should throw error if storage settings not set', async () => {
          try {
            const project = {
              ...template.project,
              settings: {},
            };
            await azureStorage.getEmailFileUrl(project);
            assert.fail('Expected an error to be thrown');
          }
          catch(err) {
            assert.equal(err.message, 'Storage settings not set.');
          }
        });

        it('Should throw error if file not provided', async () => {
          try {
            await azureStorage.getEmailFileUrl(template.project);
            assert.fail('Expected an error to be thrown');
          }
          catch(err) {
            assert.equal(err.message, 'File not provided.');
          }
        });

        it('Should throw error if azure settings are incorrect', async () => {
          try {
            await azureStorage.getEmailFileUrl(template.project, file);
            assert.fail('Expected an error to be thrown');
          }
          catch(err) {
            assert.equal(err.message, 'Unable to extract accountName with provided information.');
          }
        });
      });

      describe('Email Action Url', () => {
        let file;
        let fromConnectionStringStub;
        let generateBlobSASQueryParametersStub;
        before(() => {
          file = { name: 'fakeName' };
          fromConnectionStringStub = sinon.stub(storage.BlobServiceClient, 'fromConnectionString');
          fromConnectionStringStub.returns({
            url: 'http://fakeblob/',
            credential: 'fakeCredential',
          });
          generateBlobSASQueryParametersStub = sinon.stub(storage, 'generateBlobSASQueryParameters').returns({
            toString: sinon.stub().returns('fakeToken'),
          });
        });

        it('Should return file url for email attachment', async () => {
          try {
            const url = await azureStorage.getEmailFileUrl(template.project, file);
            assert.equal(url, 'http://fakeblob/test-container/fakeName?fakeToken');
          }
          catch(err) {
            assert.fail('An error should not be thrown');
          }
        });

        after(() => {
          fromConnectionStringStub.restore();
          generateBlobSASQueryParametersStub.restore();
        });
      });
    });

    after((done) => {
      delete process.env.ADMIN_KEY;
      done();
    });
  });
};
