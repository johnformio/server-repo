"use strict";
const fetch = require('@formio/node-fetch-http-proxy');

module.exports = () => {
  const esignProviders = require('../actions/esign/integrations')();
  return async (project, submission) => {
    const provider = esignProviders[`${submission.data.esign.provider}`];
    if (provider) {
      return provider.downloadSignature(project, submission)
        .then((downloadUrl) => {
          return fetch(downloadUrl);
        })
        .catch((error) => {
          console.log(error);
          return error;
        });
    }
    else {
      return Promise.reject('Unable to download PDF. No eSign provider was detected');
    }
  };
};
