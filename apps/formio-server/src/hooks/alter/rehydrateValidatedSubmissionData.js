'use strict';
const util = require('../../util/util');
const _ = require('lodash');

module.exports = app => (data, req) => {
  const formio = app.formio.formio;

  if (['PUT', 'PATCH'].includes(req.method) && req.currentForm.revisions === 'current') {
    const allFormFieldsPaths = {};
    formio.util.FormioUtils.eachComponent(req.currentForm.components, (comp, path) => {
      allFormFieldsPaths[path] = true;
    });
    const allSubmissionFieldsPaths = util.getAllObjectPaths(req.currentSubmissionData, true);
    allSubmissionFieldsPaths.forEach((valuePath) => {
      if (!allFormFieldsPaths.hasOwnProperty(valuePath)) {
        _.set(data, valuePath, _.get(req.currentSubmissionData, valuePath));
      }
    });
  }

  return data;
};
