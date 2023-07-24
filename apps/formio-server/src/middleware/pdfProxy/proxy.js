'use strict';
const config = require('../../../config');
module.exports = {
    authenticate: (req, project) => {
        req.pdfServer = config.pdfServer;

        // Set the license key header for authorization.
        req.headers["x-license-key"] = process.env.LICENSE_KEY;

        // It is a problem if the environment variable is not set in hosted. We do not want them to be able to point
        // to arbitrary pdf servers if they are on our hosted environments.
        if (!req.pdfServer && config.formio.hosted) {
            throw new Error('No PDF_SERVER environment configuration.');
        }

        // Always use the environment variable. If it does not exist, then we can try the project settings.
        if (!req.pdfServer && project.settings && project.settings.pdfserver) {
            req.pdfServer = project.settings.pdfserver;
        }
    }
};
