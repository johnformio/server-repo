'use strict';
const _ = require('lodash');
const attachSignaturesToMultipleSubmissions = require('../../esignature/attachSignaturesToMultipleSubmissions');
const debug = require('debug')('hook:transformReferences');

module.exports = app => async (subSubmsPromise, formId, req) => {
  const subSubms = await subSubmsPromise;
  if (_.isEmpty(subSubms) || !formId) {
    return subSubms;
  }

  try {
    return await attachSignaturesToMultipleSubmissions(app.formio, req, subSubms, formId);
  }
  catch (e) {
    debug(e);
    return subSubms;
  }
};
