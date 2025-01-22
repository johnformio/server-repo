'use strict';

class ESignRequest {
    constructor(submission, signers, approvers, finalCopyRecipients, type, config, pdfContent, emailSubject, emailMessage, provider, uploadFileName, uploadFolderName) {
        this.submission = submission;
        this.signers = signers;
        this.approvers = approvers;
        this.finalCopyRecipients = finalCopyRecipients;
        this.type = type;
        this.config = config;
        this.pdfContent = pdfContent;
        this.emailSubject = emailSubject;
        this.emailMessage = emailMessage;
        this.provider = provider;
        this.uploadFileName = uploadFileName;
        this.uploadFolderName = uploadFolderName;
    }
}

module.exports = ESignRequest;
