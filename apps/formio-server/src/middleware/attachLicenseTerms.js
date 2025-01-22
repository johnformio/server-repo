'use strict';

const _ = require('lodash');

module.exports = function(licenseValidationPromise, app) {
  return async (req, res, next) => {
    try {
      await licenseValidationPromise;
      let terms = _.get(app, 'license.terms', null);
      if (process.env.TEST_SUITE === '1') {
        if (process.env.TEST_SIMULATE_SAC_PACKAGE === '1') {
          terms = {...terms, options: {...terms.options, sac: true}};
        }
        else {
          terms = {...terms, options: {...terms.options, sac: false}};
        }
      }
      req.licenseTerms = terms;
      return next();
    }
    catch (err) {
      return next();
    }
  };
};
