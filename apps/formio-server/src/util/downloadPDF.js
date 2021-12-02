'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
const fetch = require('formio/src/util/fetch');
const {getLicenseKey} = require('./utilization');
const {getPDFUrls} = require('./pdf');
const util = require('./util');
const PDF_SERVER = process.env.PDF_SERVER || process.env.FORMIO_FILES_SERVER;
module.exports = (formioServer) => {
  const formio = formioServer.formio;
  const encrypt = require('./encrypt')(formioServer);
  Promise.promisifyAll(formio.cache, {context: formio.cache});
  return async (req, project, form, submission) => {
    // Download PDF from SignRequest
    if (project.settings.signrequest && submission.data.signrequest) {
      const {apiKey, apiUrl} = project.settings.signrequest;
      const {document} = submission.data.signrequest;
      const url = `${apiUrl}/api/v1/documents/${document.uuid}/`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          authorization: `Token ${apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.pdf) {
          return fetch(data.pdf);
        }
      }
    }

    // Swap in form components from earlier revision, if applicable
    if (form.revisions === 'original' && submission._fvid !== form._vid) {
      const result = await Promise.promisify(formio.resources.formrevision.model.findOne, {
        context: formio.resources.formrevision.model
      })({
        project: project._id,
        _rid: formio.util.idToBson(form._id),
        _vid: parseInt(submission._fvid),
      });

      if (result) {
        form.components = result.toObject().components;
        form.settings = result.toObject().settings;
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

    const pdfUrls = getPDFUrls(req.currentProject);

    if (req.query.from) {
      pdfUrls.local = req.query.from;
      delete req.query.from;
    }

    // Create the headers object
    const headers = {
      'x-license-key': getLicenseKey(req),
      'content-type': 'application/json',
      'x-host': util.baseUrl(formio, req)
    };

    // Pass along the auth token to files server
    if (req.token) {
      if (req.token.user && req.token.form) {
        headers['x-jwt-token'] = formio.auth.getToken({
          form: req.token.form,
          user: req.token.user,
          project: req.token.project,
          jti: req.token.jti
        });
      }
      else {
        headers['x-jwt-token'] = formio.auth.getToken(_.omit(req.token, 'allow'));
      }
    }

    const pdfSrc = _.get(form, 'settings.pdf.src');
    let url = null;

    // If they do not provide any PDF_SERVER definition, then we will use the project configuration.
    if (!PDF_SERVER && pdfSrc && !req.query.project && !req.params.fileId) {
      // If settings.pdf.src is available, and no custom settings were supplied, use it
      url = `${pdfSrc}/download`;

      // Use pdf as default format
      req.query.format = req.query.format || 'pdf';
    }
    else {
      // Otherwise, fall back to old behavior
      const pdfProject = req.query.project || project._id.toString();
      const fileId = req.params.fileId || 'pdf';
      url = `${pdfUrls.local}/pdf/${pdfProject}/file/${fileId}/download`;
    }

    const globalPdfSettings = _.get(project, 'settings.pdf', {});

    return fetch(url, {
      method: 'POST',
      qs: {...req.query, project: req.params.projectId},
      headers: headers,
      rejectUnauthorized: false,
      body: JSON.stringify({
        form,
        submission,
        settings: globalPdfSettings
      }),
    });
  };
};
