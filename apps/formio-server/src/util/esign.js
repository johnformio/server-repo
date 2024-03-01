'use strict';

const LOG_EVENT = 'esign:';

module.exports = (app) => {
    const log = (...args) => console.log(LOG_EVENT, ...args);
    const esignProviders = require('../actions/esign/integrations')(app);

    const sign = async (req, res, next, esignRequest) => {
        const provider = esignProviders[`${esignRequest.provider}`];

        if (provider) {
            return provider.buildAndSendRequest(req, esignRequest);
        }
         else {
            log(req, 'No eSign provider was detected\n', esignRequest);
            return 'No eSign provider was detected';
        }
    };

    return {
        sign
    };
};
