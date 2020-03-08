'use strict';

const _ = require('lodash');

module.exports = (app) => async (params, req) => {
  const formioServer = app.formio;

  params.config = req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {};

  // Replace encrypted params.data values with decrypted versions
  const encrypt = require('../../util/encrypt')(formioServer);

  if (encrypt.hasEncryptedComponents(req)) {
    params = await new Promise((resolve, reject) => {
      encrypt.encryptDecrypt(req, req.submission, 'decrypt', () => {
        params.data = _.cloneDeep(req.submission.data || {});
        resolve(params);
      });
    });
  }

  // Attach file URLs
  const urlPromises = _.chain(params.components)
    .filter(component => component.type === 'file')
    .map(component => params.data[component.key])
    .flatten()
    .compact()
    .map(async file => {
      if (['s3', 'azure', 'dropbox'].includes(file.storage)) {
        try {
          file.url = await require(`../../storage/${file.storage}`).getUrl({project: req.currentProject, file});
        }
        catch (err) {
          // Don't let a failure on one file derail the whole email action
        }
      }
    })
    .value();

  await Promise.all(urlPromises);

  return params;
};
