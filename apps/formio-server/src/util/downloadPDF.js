'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
const fetch = require('@formio/node-fetch-http-proxy');
const processChangeLogData = require('./processChangeLogData');
const proxy = require('../middleware/pdfProxy/proxy');

module.exports = (formioServer) => {
  const formio = formioServer.formio;
  const encrypt = require('./encrypt')(formioServer);
  Promise.promisifyAll(formio.cache, {context: formio.cache});
  return async (req, project, form, submission) => {
    proxy.authenticate(req, project);
    proxy.updateHeadersForPdfRequest(req, formio);

    // TODO_esign
    // if (submission.data.esign && submission.data.esign.fileId) {
    //   return require('./downloadEsign')()(project, submission);
    // }

    // Swap in form components from earlier revision, if applicable
    if (form.revisions === 'original') {
      const submissionFormRevisionId = submission._frid ? submission._frid.toString() : submission._fvid;
      if (submissionFormRevisionId !== form._vid) {
        let result;
        if (submissionFormRevisionId.length === 24) {
          result = await Promise.promisify(formio.resources.formrevision.model.findOne, {
            context: formio.resources.formrevision.model
          })({
            _id: formio.util.idToBson(submissionFormRevisionId),
          });
        }
        else {
          result = await Promise.promisify(formio.resources.formrevision.model.findOne, {
            context: formio.resources.formrevision.model
          })({
            project: project._id,
            _rid: formio.util.idToBson(form._id),
            _vid: parseInt(submissionFormRevisionId),
          });
        }
        if (result) {
          form.components = result.toObject().components;
          form.settings = result.toObject().settings;
        }
      }
    }

    // Speed up performance by loading all subforms inline to the form
    await formio.cache.loadSubFormsAsync(form, req);

    // Load all subform submissions
    await formio.cache.loadSubSubmissionsAsync(form, submission, req);

    // Remove protected fields
    formio.util.removeProtectedFields(form, 'download', submission);

    // Decrypt encrypted fields
    req.flattenedComponents = formio.util.flattenComponents(form.components, true);

    if (
      encrypt.hasEncryptedComponents(req)
    ) {
      await new Promise((resolve) => encrypt.encryptDecrypt(req, submission, 'decrypt', resolve));
    }

    if (req.changelog && req.changelog.length > 0) {
      processChangeLogData(req.changelog, form, submission);
    }

    req.headers['content-type'] = 'application/json';

    // Pass along the auth token to files server
    if (req.token) {
      if (req.token.user && req.token.form) {
        req.headers['x-jwt-token'] = formio.auth.getToken({
          form: req.token.form,
          user: req.token.user,
          project: req.token.project,
          jti: req.token.jti
        });
      }
      else {
        req.headers['x-jwt-token'] = formio.auth.getToken(_.omit(req.token, 'allow'));
      }
    }

    req.query.format = req.query.format || 'pdf';
    const pdfProject = req.query.project || project._id.toString();
    const url = `${req.pdfServer}/pdf/${pdfProject}/download`;
    const globalPdfSettings = _.get(project, 'settings.pdf', {});
    const qs = new URLSearchParams({...req.query, project: req.params.projectId || req.currentProject._id.toString()});
    return fetch(`${url}?${qs}`, {
      method: 'POST',
      headers: req.headers,
      rejectUnauthorized: false,
      body: JSON.stringify({
        form,
        submission,
        settings: globalPdfSettings
      }),
    });
  };
};
