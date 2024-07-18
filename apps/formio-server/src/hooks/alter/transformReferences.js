'use strict';
const _ = require('lodash');
const attachSignaturesToMultipleSubmissions = require('../../esignature/attachSignaturesToMultipleSubmissions');

module.exports = app => (subSubmsPromise, formId, req) => {
  if (!formId) {
    return;
  }

  return subSubmsPromise?.then((subSubms) => {
    if (_.isEmpty(subSubms)) {
        return;
    }

    let refPromiseResolve;
    const refPromise = new Promise(res => {
      refPromiseResolve = res;
    });

    attachSignaturesToMultipleSubmissions(app.formio, req, subSubms, formId, () => {
      refPromiseResolve();
    });

    return refPromise;
  });
};
