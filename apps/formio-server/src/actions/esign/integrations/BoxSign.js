'use strict';

var BoxSDK = require('box-node-sdk');
const _ = require('lodash');
const LOG_EVENT = 'BoxSign:';
module.exports = (app) => {
    const log = (...args) => console.log(LOG_EVENT, ...args);

    const authenticateToBox = (config) => {
        const sdk = new BoxSDK({
            clientID: config.boxAppSettings.clientID,
            clientSecret: config.boxAppSettings.clientSecret,
            appAuth: {
                keyID: config.boxAppSettings.appAuth.publicKeyID,
                privateKey: config.boxAppSettings.appAuth.privateKey,
                passphrase: config.boxAppSettings.appAuth.passphrase
            }
        });
        return sdk.getAppAuthClient('enterprise', config.enterpriseID);
    };

    const createFolder = async (esignRequest, authClient) => {
        // Check if folder exists first so as to not cause collision
        let folderId;
        if (esignRequest.submission.data && esignRequest.submission.data.esign && esignRequest.submission.data.esign.folderId) {
            folderId = esignRequest.submission.data.esign.folderId;
        }
        if (!folderId) {
            folderId = authClient.folders.create('0', esignRequest.uploadFolderName)
                .then((folder) => {
                    return folder.id;
                })
                .catch((error) => {
                    log('Unable to create folder: ', error);
                    throw `Unable to create folder: ${error}`;
                });
        }
        return folderId;
    };

    const uploadToBox = async (esignRequest, authClient, folderId) => {
        const base64Buffer = Buffer.from(esignRequest.pdfContent, 'base64');
        var options = {
            /* eslint-disable  camelcase */
            content_length: Buffer.byteLength(esignRequest.pdfContent, 'base64')
        };

        // Check if the file already exists. If so, update it's version
        let fileId;
        if (esignRequest.submission.data && esignRequest.submission.data.esign && esignRequest.submission.data.esign.fileId) {
            fileId = esignRequest.submission.data.esign.fileId;
        }
        if (fileId) {
            const uploadedFile = authClient.files
            .uploadNewFileVersion(fileId, base64Buffer, options)
            .then((file) => {
                log(file);
                return file;
            })
            .catch((error) => {
                log(error);
                return error;
            });
            return uploadedFile;
        }
        else {
          const uploadedFile = authClient.files
            .uploadFile(folderId, `${esignRequest.uploadFileName}.pdf`, base64Buffer, options)
            .then((file) => {
                log(file);
                return file;
            })
            .catch((error) => {
                log(error);
                return error;
            });
            return uploadedFile;
        }
    };

    const createESignRequest = async (esignRequest, authClient, file, folderId) => {
        const signers = [];
        esignRequest.signers.forEach((recipient) => {
            if (recipient.userId) {
                signers.push({
                    role: 'signer',
                    email: recipient.email,
                    order: recipient.order,
                    /* eslint-disable  camelcase */
                    embed_url_external_user_id: recipient.userId
                });
            }
            else {
                signers.push({
                    role: 'signer',
                    email: recipient.email,
                    order: recipient.order
                });
            }
        });
        esignRequest.approvers.forEach((approver) => {
            if (!_.isEmpty(approver.emailAddress)) {
              signers.push({
                role: 'approver',
                email: approver.emailAddress
                });
            }
        });
        esignRequest.finalCopyRecipients.forEach((recipient) => {
            if (!_.isEmpty(recipient.emailAddress)) {
              signers.push({
                role: 'final_copy_reader',
                email: recipient.emailAddress
                });
            }
        });
        const signRequest = authClient.signRequests.create({
            signers: signers,
            /* eslint-disable  camelcase */
            source_files: [
                {
                    type: 'file',
                    id: file.entries[0].id
                }
            ],
            /* eslint-disable  camelcase */
            parent_folder: {
                type: 'folder',
                id: folderId
            },
            email_message: esignRequest.emailMessage,
            email_subject: esignRequest.emailSubject
        })
        .then((signRequest) => {
            log(signRequest);
            return signRequest;
        })
        .catch((error) => {
            return error;
        });
        return signRequest;
    };

    const buildAndSendRequest = async (req, esignRequest) => {
        try {
            const authClient = authenticateToBox(esignRequest.config);
            if (authClient) {
                // Create folder where file will be uploaded. By default, Box cannot handle sending a sign request from the root folder.
                const folderId = await createFolder(esignRequest, authClient);

                // Upload file to Box
                const uploadedFile = await uploadToBox(esignRequest, authClient, folderId);

                // Create Esign request
                if (uploadedFile && uploadedFile.entries) {
                    const esignResponse = await createESignRequest(esignRequest, authClient, uploadedFile, folderId);
                    if (esignResponse && esignResponse.id) {
                        return esignResponse;
                    }
                    else {
                        log('Unable to create esign request', esignResponse);
                        return 'Unable to create esign request';
                    }
                }
                else {
                    log('Unable to upload file to Box');
                    return 'Unable to upload file to Box';
                }
            }
            else {
                log(req, 'Unable to authenticate to Box', esignRequest);
            }
        }
        catch (error) {
            log('Unable to process box sign', error);
            return `Unable to process box sign: ${error}`;
        }
    };

    const downloadBoxSignature = async (project, submission) => {
        const config = _.get(project.settings, 'esign');
        const privateKey = config.boxAppSettings.appAuth.privateKey;
        config.boxAppSettings.appAuth.privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
        const authClient = authenticateToBox(config);
        if (authClient) {
            return new Promise((resolve, reject) => {
                authClient.files.getDownloadURL(submission.data.esign.fileId)
                .then(url => {
                    resolve(url);
                })
                .catch(error => {
                    reject(error);
                });
            });
        }
    };

    return {
        buildAndSendRequest,
        downloadBoxSignature
    };
};
