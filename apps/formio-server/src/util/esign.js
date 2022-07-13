'use strict';

const LOG_EVENT = 'esign:';

module.exports = (app) => {
    const log = (...args) => console.log(LOG_EVENT, ...args);
    const BoxSign = require('../actions/esign/integrations/BoxSign')(app);

    const sign = async (req, res, next, esignRequest) => {
        switch (esignRequest.provider) {
            case 'Box Sign':
                return BoxSign.buildAndSendRequest(req, esignRequest);
            default:
                log(req, 'No eSign provider was detected\n', esignRequest);
                return 'No eSign provider was detected';
        }
    };

    return {
    sign
    };
};
