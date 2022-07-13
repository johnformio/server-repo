'use strict';
const ESignRequest = require('./ESignRequest');

class ESignRequestBuilder {
    constructor() {

    }
    setSubmission(submission) {
        this.submission = submission;
        return this;
    }

    setSigners(signers) {
        this.signers = signers;
        return this;
    }

    setApprovers(approvers) {
        this.approvers = approvers;
        return this;
    }

    setFinalCopyRecipients(finalCopyRecipients) {
        this.finalCopyRecipients = finalCopyRecipients;
        return this;
    }

    setType(type) {
        this.type = type;
        return this;
    }

    setConfig(config) {
        this.config = config;
        return this;
    }

    setPDFContent(pdfContent) {
        this.pdfContent = pdfContent;
        return this;
    }

    setEmailSubject(emailSubject) {
        this.emailSubject = emailSubject;
        return this;
    }

    setEmailMessage(emailMessage) {
        this.emailMessage = emailMessage;
        return this;
    }

    setProvider(provider) {
        this.provider = provider;
        return this;
    }

    setUploadFileName(uploadFileName) {
        this.uploadFileName = uploadFileName;
        return this;
    }

    setUploadFolderName(uploadFolderName) {
        this.uploadFolderName = uploadFolderName;
        return this;
    }

    build() {
        return new ESignRequest(this.submission, this.signers, this.approvers, this.finalCopyRecipients, this.type, this.config, this.pdfContent, this.emailSubject, this.emailMessage, this.provider, this.uploadFileName, this.uploadFolderName);
    }
}

module.exports = ESignRequestBuilder;
