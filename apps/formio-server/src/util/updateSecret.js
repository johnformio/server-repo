'use strict';

const util = require('./util');
const _ = require('lodash');

const reEncryptProjectSettings = async (oldSecret, secret, project, projects) => {
    try {
        const settings = util.decrypt(oldSecret, project.settings_encrypted, true);
        if (settings) {
            const reEncryptedSettings = util.encrypt(secret, settings, true);
            if (reEncryptedSettings) {
                _.set(project, 'settings_encrypted', reEncryptedSettings);

                const settingsUpdate = {};
                settingsUpdate['settings_encrypted'] = reEncryptedSettings;
                await projects.updateOne({_id: project._id}, {$set: settingsUpdate});
            }
        }
    }
    catch (err) {
        console.log(err);
    }
};

const reEncryptSubmission = async (decryptionKey, secret, currentValue, path, submission, submissions) => {
    try {
        const decryptedVal = util.decrypt(decryptionKey, currentValue.buffer);
        if (decryptedVal) {
            const encryptedVal = util.encrypt(secret, decryptedVal);
            if (encryptedVal) {
                _.set(submission, `data.${path}`, encryptedVal);

                const update = {};
                update[`data.${path}`] = encryptedVal;
                await submissions.updateOne({_id: submission._id}, {$set: update});
            }
        }
    }
    catch (err) {
        console.log(err);
    }
};

module.exports = async (formio, db, secret, oldSecret) => {
    console.log('DB Secret update required.');
    const projects = db.collection('projects');
    const cursor = projects.find({deleted: {$eq: null}});

    while (await cursor.hasNext()) {
        const project = await cursor.next();
        const forms = db.collection('forms');
        const formsCursor = await forms.find({'project': project._id, deleted: {$eq: null}});
        const decryptionKey = project.settings?.secret || oldSecret;

        if (project.settings_encrypted) {
            await reEncryptProjectSettings(oldSecret, secret, project, projects);
        }

        while (await formsCursor.hasNext()) {
            const form = await formsCursor.next();
            formio.util.eachComponent(form.components, async function(component, path) {
                if (component.encrypted) {
                    const submissions = form.settings?.collection ? db.collection(form.settings.collection) : db.collection('submissions');
                    const submissionsCusor = submissions.find({form: form._id, deleted: {$eq: null}});
                    while (await submissionsCusor.hasNext()) {
                        const submission = await submissionsCusor.next();
                        const currentValue = _.get(submission, `data.${path}`);
                        if (!currentValue) {
                            continue;
                        }
                        await reEncryptSubmission(decryptionKey, secret, currentValue, path, submission, submissions);
                    }
                }
            });
        }
    }
};
