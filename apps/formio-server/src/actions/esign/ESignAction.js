'use strict';
const LOG_EVENT = 'ESign Action:';
const _ = require('lodash');
const ESignRequestBuilder = require('./EsignRequestBuilder');

module.exports = (router) => {
    const Action = router.formio.Action;
    const hook = router.formio.hook;
    const esigner = require('../../util/esign')(router);
    const log = (...args) => console.log(LOG_EVENT, ...args);
    const downloadPDF = require('../../util/downloadPDF')(router);

    // status strings
    const PROJECT_NOT_FOUND = 'Project was not found.';
    const ESIGN_CONFIG_NOT_FOUND = 'Config settings for eSign were not found.';
    const SUBMISSION_NOT_FOUND = 'Submission id was not found.';
    const EMAIL_IS_EMPTY = 'Email was undefined/unable to be interpolated.';
    const PROVIDER_MISMATCH = 'A mismatch was detected among eSignature providers. Please ensure all eSignatures are using the same provider.';
    const SIGNING_NOW_STATUS = 'Built esignrequest. Signing now.';
    const ESIGN_SENT = 'eSign request sent.';

    /**
     * eSignAction class
     * this class is used to create an eSign action
     */
    class eSignAction extends Action {
        static info(req, res, next) {
            next(null, hook.alter('actionInfo', {
                name: 'esign',
                title: 'eSign',
                description: 'Allows you to create an eSignature',
                priority: 6,
                defaults: {
                  handler: ['after'],
                  method: ['create', 'update']
                }
              }));
        }

        static settingsForm(req, res, next) {
            next(null, [
            {
                label: "Approvers",
                reorder: false,
                addAnother: "Add Another Approver",
                addAnotherPosition: "bottom",
                description: "Users that need to approve the PDF generated form submission",
                layoutFixed: false,
                enableRowGroups: false,
                initEmpty: false,
                tableView: false,
                key: "approvers",
                type: "datagrid",
                input: true,
                components: [
                    {
                        label: "Email Address",
                        tableView: true,
                        key: "emailAddress",
                        type: "textfield",
                        input: true
                    }
                ]
            },
            {
                label: "Final Signed Copy Recipients",
                reorder: false,
                addAnother: "Add Another Recipient",
                addAnotherPosition: "bottom",
                description: "Users that will receive a copy of the fully signed document upon completion",
                layoutFixed: false,
                enableRowGroups: false,
                initEmpty: false,
                tableView: false,
                defaultValue: [
                    {}
                ],
                key: "finalCopyRecipients",
                type: "datagrid",
                input: true,
                components: [
                    {
                        label: "Email Address",
                        tableView: true,
                        key: "emailAddress",
                        type: "textfield",
                        input: true
                    }
                ]
            },
            {
                type: 'checkbox',
                key: 'redirect',
                label: 'Automatically redirect to E-Sign provider on Form Submit.',
                description: 'By checking this box, you will be included as a signer and redirected upon form submission to the configured eSign provider\'s website.'
            },
            {
                type: 'textfield',
                key: 'emailSubject',
                label: 'Email Subject',
                description: 'Email Subject line of the sign request email.',
                input: true
            },
            {
                type: 'textarea',
                key: 'emailMessage',
                label: 'Email Message',
                description: 'A custom message to include in the sign request email.',
                input: true
            },
            {
                type: 'textfield',
                key: 'uploadFileName',
                label: 'Name of upload PDF File',
                description: 'The name of the file to be uploaded and sent. This can be interpolated. Do <b>not</b> include .pdf in the name',
                input: true
            }
            ]);
        }

        /**
         * Uploads a PDF to an integration provider and triggers a redirect to provide an eSignature
         * @param {*} handler
         * @param {*} method
         * @param {*} req
         * @param {*} res
         * @param {*} next
         * @returns
         */
        async resolve(handler, method, req, res, next, setActionItemMessage) {
            if (method === 'delete') {
                return next();
            }
            const {settings} = this;
            const {interpolate, eachComponent} =  router.formio.util.FormioUtils;
            const submission = req.submission;
            const project = await router.formio.cache.loadProject(req, req.projectId);
            if (!project) {
                log(req, PROJECT_NOT_FOUND);
                setActionItemMessage(PROJECT_NOT_FOUND);
                return res.status(400).send(PROJECT_NOT_FOUND);
            }
            const esignConfig = _.get(project.settings, 'esign');
            if (!esignConfig && !esignConfig.boxAppSettings) {
                log(req, ESIGN_CONFIG_NOT_FOUND);
                setActionItemMessage(ESIGN_CONFIG_NOT_FOUND);
                return res.status(400).send(ESIGN_CONFIG_NOT_FOUND);
            }
            // Replace \\n with \n chars because the renderer sanitizes \n with \\n
            const privateKey = esignConfig.boxAppSettings.appAuth.privateKey;
            esignConfig.boxAppSettings.appAuth.privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
            const submissionId = res.resource && res.resource.item && res.resource.item._id.toString();
            if (!submissionId) {
                log(req, SUBMISSION_NOT_FOUND);
                setActionItemMessage(SUBMISSION_NOT_FOUND);
                return res.status(400).send(SUBMISSION_NOT_FOUND);
            }
            const {redirect, emailSubject, emailMessage, approvers, finalCopyRecipients} = settings;
            // Set Upload file and folder names
            let uploadFileName = submissionId;

            const interpolationData = {data: submission.data, submission};

            if (!_.isEmpty(settings.uploadFileName)) {
                uploadFileName = interpolate(settings.uploadFileName, interpolationData);
                if (_.isEmpty(uploadFileName)) {
                    uploadFileName = submissionId;
                }
            }
            const uploadFolderName = `${req.formId} - ${submissionId}`;

            // Get signers
            const signatureCompsKeys = [];
            const providers = [];
            eachComponent(req.currentForm.components, comp => {
                if (comp.type === 'signature' && comp.provider.name !== 'default') {
                    const email = interpolate(comp.email, interpolationData);
                    if (_.isEmpty(email)) {
                        setActionItemMessage(EMAIL_IS_EMPTY);
                        return res.status(400).send(EMAIL_IS_EMPTY);
                    }
                    const signer = {};
                    signer['email'] = email;
                    signer['provider'] = comp.provider.name;

                    let userId;

                    if (redirect) {
                        userId = req.user && req.user._id;

                        if (!userId) {
                            //create user id for anonymous user to use it in box sign
                            const submissionModified = new Date(res.resource.item.modified).getTime();
                            userId = `anonym-${submissionId}-${submissionModified}`;
                        }
                    }

                    if (comp.order) {
                        if (comp.order === 1 && redirect) {
                            signer['userId'] = userId;
                        }
                        signer['order'] = comp.order;
                    }
                    else if (redirect) {
                        signer['userId'] = userId;
                        comp.order = 1;
                    }
                    else {
                        comp.order = 1;
                    }
                    signatureCompsKeys.push(signer);
                    providers.push(comp.provider.name);
                }
            });

            const uniqueProviders = new Set(providers);

            // Verify no mismatches for signer provider
            if (uniqueProviders.size > 1) {
                log(req, PROVIDER_MISMATCH);
                setActionItemMessage(PROVIDER_MISMATCH);
                return res.status(400).send(PROVIDER_MISMATCH);
            }
            const provider = providers[0];

            if (!provider) {
                return next();
            }

            // Download PDF submission and convert to base64
            const form = await router.formio.cache.loadCurrentForm(req);
            const pdf = await downloadPDF(req, project, form, submission);
            const responseBuffer = await pdf.buffer();
            const base64 = responseBuffer.toString('base64');

            const transformRecipients = (recipients) => {
                if (!_.isArray(recipients) || _.isEmpty(recipients)) {
                    return [];
                }

                const transformedRecipients = recipients.map(recipientSettings => {
                    if (!recipientSettings.emailAddress) {
                        return recipientSettings;
                    }

                    const email = interpolate(recipientSettings.emailAddress, interpolationData);

                    return _.chain(_.split(email, ','))
                        .filter(emailAddress => emailAddress)
                        .map(emailAddress => ({...recipientSettings, emailAddress: _.trim(emailAddress)}))
                        .value();
                });

                return _.flatten(transformedRecipients);
            };

            const esignRequest = new ESignRequestBuilder()
                .setSubmission(submission)
                .setType(provider)
                .setSigners(signatureCompsKeys)
                .setApprovers(transformRecipients(approvers))
                .setFinalCopyRecipients(transformRecipients(finalCopyRecipients))
                .setConfig(esignConfig)
                .setProvider(provider)
                .setPDFContent(base64)
                .setEmailSubject(interpolate(emailSubject, interpolationData))
                .setEmailMessage(interpolate(emailMessage, interpolationData))
                .setUploadFileName(uploadFileName)
                .setUploadFolderName(uploadFolderName)
                .build();
            log(req, SIGNING_NOW_STATUS);
            const {config, pdfFormSubmissionUrl, ...loggableEsignRequest} = esignRequest;
            setActionItemMessage(SIGNING_NOW_STATUS, {
                message: loggableEsignRequest
            });
            const response = await esigner.sign(req, res, next, esignRequest);
            if (response && response.id) {
                res.submission.data.esign = response;
                const updates = {
                    $set: {
                    'data.esign': {
                        id: response.id,
                        name: response.name,
                        status: response.status,
                        folderId: response.parent_folder.id,
                        fileId: response.sign_files.files[0].id,
                        provider: provider
                    }
                    }
                };
                router.formio.resources.submission.model.findByIdAndUpdate(
                    res.resource.item._id,
                    updates
                  ).exec();
                  setActionItemMessage(ESIGN_SENT);
                  log(ESIGN_SENT);
            }
            else {
                setActionItemMessage(response);
                return res.status(500).send(response);
            }
            return next();
        }
    }

    return eSignAction;
};
