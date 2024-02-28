'use strict';

const _ = require('lodash');
const util = require('../../util/util');
const {storages} = require('../../storage');

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
  const urlPromises = _.chain(params.componentsWithPath || params.components)
    .filter(component => component.type === 'file')
    .map(component => {
      let {compPath} = component;

      compPath = compPath || component.key;

      if (compPath && compPath.indexOf('.') !== -1) {
        compPath = compPath.split('.');
      }
      return util.getComponentDataByPath(compPath, params.data);
    })
    .flattenDeep()
    .compact()
    .map(async file => {
      if (['s3', 'azure', 'googledrive', 'dropbox'].includes(file.storage)) {
        try {
          file.url = (await storages[file.storage].getUrl({project: req.currentProject, file, fromAction: true})).url;
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
