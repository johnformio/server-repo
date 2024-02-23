'use strict';
const fetch = require('@formio/node-fetch-http-proxy');

module.exports = () => {
    const BoxSign = require('../actions/esign/integrations/BoxSign')();
    return async (project, submission) => {
        switch (submission.data.esign.provider) {
            case 'Box Sign':
            return BoxSign.downloadBoxSignature(project, submission)
            .then((downloadUrl) => {
                return fetch(downloadUrl, {
                    rejectUnauthorized: false
                });
            })
            .catch((error) => {
                console.log(error);
                return error;
            });
        }
    };
};
