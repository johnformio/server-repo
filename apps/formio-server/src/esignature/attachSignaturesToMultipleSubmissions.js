'use strict';
const _ = require('lodash');
const ESignature = require('./ESignature');
const debug = require('debug')('attachSignaturesToMultipleSubmissions');

module.exports = async (formioServer, req, submissions, formId) => {
    submissions = submissions || [];
    if (_.isEmpty(submissions)) {
      return submissions;
    }

    const form = await formioServer.formio.cache.loadForm(req, null, formId, false);

    if (!form) {
      debug(`Unable to load reference form: ${formId}`);
      return submissions;
    }

    const esignature = new ESignature(formioServer, req);

    if (esignature.allowESign(form)) {
      debug(`Load eSignatures for submissions of form ${formId}`);
      const esignPromises = _.map(submissions, async (subm) => {
        const esignature = new ESignature(formioServer, req);
        return await esignature.attachESignatures(subm);
      });

      await Promise.all(esignPromises);
    }

    return submissions;
};
