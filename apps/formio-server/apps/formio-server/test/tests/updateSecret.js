/* eslint-env mocha */
'use strict';

const _ = require('lodash');
const assert = require('assert');
const updateSecret = require('../../src/util/updateSecret');
const util = require('../../src/util/util');
const ObjectId = require('mongodb').ObjectId;

module.exports = (app, template, hook) => {

    const tempProject = {
        title: 'DB Secret Test',
        description: 'Test Project for DB Secret',
        template: _.pick(template, ['title', 'name', 'version', 'description', 'roles', 'resources', 'forms', 'actions', 'access']),
        name: 'dbSecretTestProject',
        type: 'project',
        tag: '0.0.0',
        plan: 'commercial',
        steps: [],
        framework: 'custom',
        protect: false,
        primary: false,
        deleted: null,
        formDefaults: null,
        stageTitle: 'Live',
        access: [
        {
            type: 'create_all',
            roles: [ `ObjectId('6581abb303d962ea35f4b406')` ]
        },
        {
            type: 'read_all',
            roles: [ `ObjectId('6581abb303d962ea35f4b406')` ]
        },
        {
            type: 'update_all',
            roles: [ `ObjectId('6581abb303d962ea35f4b406')` ]
        },
        {
            type: 'delete_all',
            roles: [ `ObjectId('6581abb303d962ea35f4b406')` ]
        }
        ],
        machineName: 'wmaysilretlsxfw',
        __v: 1
    };

    const testForm = {
        title: 'DB Secret Test Form',
        name: 'dbSecretTestForm',
        path: 'testForm',
        type: 'form',
        components: [{
            label: 'Name',
            applyMaskOn: 'change',
            tableView: true,
            encrypted: true,
            key: 'name',
            type: 'textfield',
            input: true
          },
          {
            label: 'Description',
            applyMaskOn: 'change',
            autoExpand: false,
            tableView: true,
            encrypted: true,
            key: 'description',
            type: 'textarea',
            input: true
          },
          {
            type: 'button',
            label: 'Submit',
            key: 'submit',
            disableOnInvalid: true,
            input: true,
            tableView: false
          }]
    };

    const testSubmission = {
        deleted: null,
        roles: [],
        access: [],
        data: {},
        _fvid: 0,
        state: 'submitted',
        externalIds: [],
        externalTokens: [],
        __v: 0
    };

    const settings = {
        "appOrigin": "http://localhost:3000",
        "keys": [
            {
                "key": "0t4stKlxpoXexY8W5DrxWuDACoDBET",
                "name": "key 1"
            }
        ],
        "cors": "*",
        "sqlconnector": {
            "type": ""
        },
        "allowConfig": true
    };

    const secret = 'secret';
    const secretOld = 'secretOld';
    const db = app.formio.formio.db;

    describe('Update DB Secret unit tests', () => {

        let projectId;
        let formId;
        let submissionId;
        let initialNameValue = 'testName';
        let initialDescValue = 'testDesc';
        let initialNameValueEncrypted;
        let initialDescValueEncrypted;

        before((done) => {
            const projects = db.collection('projects');

            const encryptedSettings = util.encrypt(secretOld, settings, true);
            _.set(tempProject, 'settings_encrypted', encryptedSettings);

            projects.insertOne(tempProject)
            .then(projectResult => {
                projectId = projectResult.insertedId;
                const forms = db.collection('forms');
                testForm.project = new ObjectId(projectId);
                forms.insertOne(testForm)
                    .then(formResult => {
                        formId = formResult.insertedId;
                        const submissions = db.collection('submissions');
                        testSubmission.form = new ObjectId(formId);
                        testSubmission.owner = new ObjectId(template.formio.owner._id);
                        testSubmission.project = new ObjectId(projectId);

                        const testInput = {
                            name: util.encrypt(secretOld, initialNameValue),
                            description: util.encrypt(secretOld, initialDescValue)
                        };

                        testSubmission.data = testInput;
                        submissions.insertOne(testSubmission)
                        .then(submissionResult => {
                            submissionId = submissionResult.insertedId;
                            done();
                        })
                        .catch(done);
                })
                .catch(done);
            })
            .catch(done);
        });

        it('Should verify encryted project settings', function(done) {
            const projects = db.collection('projects');
            projects.findOne({'_id': new ObjectId(projectId)})
            .then(project => {

                const decryptedSettings = util.decrypt(secretOld, project.settings_encrypted, true);

                assert.notEqual(project.settings_encrypted, null);
                assert.notEqual(project.settings_encrypted, settings);
                assert.deepEqual(decryptedSettings, settings);
                done();
            })
            .catch(done);
        });

        it('Should verify initial encrypted fields with old secret', function(done) {
            const submissions = db.collection('submissions');
            submissions.findOne({'_id': new ObjectId(submissionId)})
            .then((submission) => {
                const sName = submission.data.name;
                const sDesc = submission.data.description;

                initialNameValueEncrypted = sName;
                initialDescValueEncrypted = sDesc;

                const sNameDecrypt = util.decrypt(secretOld, sName.buffer);
                const sDescDecrypt = util.decrypt(secretOld, sDesc.buffer);

                assert.notEqual(initialNameValue, sName);
                assert.notEqual(initialDescValue, sDesc);
                assert.equal(initialNameValue, sNameDecrypt);
                assert.equal(initialDescValue, sDescDecrypt);
                done();
            })
            .catch(done);
        });

        it('Should re-encrypt project settings and submission fields using new secret', function(done) {
            updateSecret(app.formio.formio, db, secret, secretOld)
            .then(() => {

                const projects = db.collection('projects');
                projects.findOne({'_id': new ObjectId(projectId)})
                .then(project => {

                    const decryptedSettings = util.decrypt(secret, project.settings_encrypted, true);

                    assert.notEqual(project.settings_encrypted, null);
                    assert.notEqual(project.settings_encrypted, settings);
                    assert.deepEqual(decryptedSettings, settings);

                    const submissions = db.collection('submissions');
                    submissions.findOne({'_id': new ObjectId(submissionId)})
                    .then((submission) => {
                        const sName = submission.data.name;
                        const sDesc = submission.data.description;
                        const sNameDecrypt = util.decrypt(secret, sName.buffer);
                        const sDescDecrypt = util.decrypt(secret, sDesc.buffer);

                        assert.notEqual(secretOld, secret);
                        assert.notEqual(initialNameValue, sName);
                        assert.notEqual(initialDescValue, sDesc);
                        assert.notEqual(initialNameValueEncrypted, sName);
                        assert.notEqual(initialDescValueEncrypted, sDesc);
                        assert.equal(initialNameValue, sNameDecrypt);
                        assert.equal(initialDescValue, sDescDecrypt);

                        done();
                    })
                    .catch(done);
                })
                .catch(done);
            })
            .catch(done);
        });

        after((done) => {
            const projects = db.collection('projects');
            const forms = db.collection('forms');
            const submissions = db.collection('submissions');
            projects.deleteOne({'_id': new ObjectId(projectId)})
            .then(() => {
                forms.deleteOne({'_id': new ObjectId(formId)})
                .then(() => {
                    submissions.deleteOne({'_id': new ObjectId(submissionId)})
                    .then(() => {
                        done();
                    })
                });
            })
            .catch(done);
        });
    });
};
