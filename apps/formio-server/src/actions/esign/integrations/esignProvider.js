'use strict';

module.exports = () => {
    const buildAndSendRequest = async (req, esignRequest) => {
        // TODO_esign: logic that creates folder where file will be uploaded, uploads file to esign provider and returns Esign provider response
    };

    const downloadSignature = async (project, submission) => {
        // TODO_esign: logic that returns Promise with download URL of the file with signature
    };

    return {
        buildAndSendRequest,
        downloadSignature
    };
};
