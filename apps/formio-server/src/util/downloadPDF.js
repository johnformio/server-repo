'use strict';
const _ = require('lodash');
const fetch = require('formio/src/util/fetch');
const util = require('./util');
const processChangeLogData = require('./processChangeLogData');
const proxy = require('../middleware/pdfProxy/proxy');
const {promisify} = require('util');

module.exports = (formioServer) => {
  const formio = formioServer.formio;
  const encrypt = require('./encrypt')(formioServer);
  const loadSubFormsAsync = promisify(formio.cache.loadSubForms);
  const loadSubSubmissionsAsync = promisify(formio.cache.loadSubSubmissions);

  return async (req, project, form, submission) => {
    proxy.authenticate(req, project);

    if (submission.data.esign && submission.data.esign.fileId) {
      return require('./downloadEsign')()(project, submission);
    }

    // Swap in form components from earlier revision, if applicable
    if (form.revisions === 'original') {
      const submissionFormRevisionId = submission._frid ? submission._frid.toString() : submission._fvid;
      if (submissionFormRevisionId !== form._vid) {
        let result;
        const formRevisionModel = formio.resources.formrevision.model;

        if (submissionFormRevisionId.length === 24) {
          result = await formRevisionModel.findOne({
            _id: formio.util.idToBson(submissionFormRevisionId),
          });
        }
        else {
          result = await formRevisionModel.findOne({
            project: project._id,
            _rid: formio.util.idToBson(form._id),
            _vid: parseInt(submissionFormRevisionId),
          });
        }
        // TODO: Check if 'toObject()' call is needed
        if (result) {
          form.components = result.toObject().components;
          form.settings = result.toObject().settings;
        }
      }
    }

    // Speed up performance by loading all subforms inline to the form
    await loadSubFormsAsync(form, req);

    // Load all subform submissions
    await loadSubSubmissionsAsync(form, submission, req);

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
    req.headers['x-host'] = util.baseUrl(formio, req);

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
