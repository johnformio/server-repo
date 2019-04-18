'use strict';

module.exports = (app) => (params, req) => {
  const formioServer = app.formio;

  params.config = req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {};

  // Replace encrypted params.data values with decrypted versions
  const encrypt = require('../../util/encrypt')(formioServer);

  if (encrypt.hasEncryptedComponents(req)) {
    return new Promise((resolve, reject) => {
      return encrypt.encryptDecrypt(req, req.submission, 'decrypt', () => {
        const _ = require('lodash');
        params.data = _.cloneDeep(req.submission.data || {});
        resolve(params);
      });
    });
  }

  return params;
};
