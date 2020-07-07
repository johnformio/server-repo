'use strict';
const fetch = require('formio/src/util/fetch');
const PDF_SERVER = process.env.PDF_SERVER || process.env.FORMIO_FILES_SERVER || 'https://files.form.io';
const _ = require('lodash');
const Promise = require('bluebird');
const {getLicenseKey} = require('../util/utilization');

module.exports = (formioServer) => async (req, res, next) => {
  const encrypt = require('../util/encrypt')(formioServer);
  const formio = formioServer.formio;
  Promise.promisifyAll(formio.cache, {context: formio.cache});

  try {
    // Load project
    const project = req.primaryProject;

    // Load the provided form
    const formId = req.query.form || formio.cache.getCurrentFormId(req);
    const form = await formio.cache.loadFormAsync(req, null, formId);

    // Load the current submission
    const submission = await formio.cache.loadCurrentSubmissionAsync(req);

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

    // Set the files server
    let filesServer = PDF_SERVER;
    if (process.env.FORMIO_HOSTED && project.settings.pdfserver) {
      // Allow them to download from any server if it is set to the default
      filesServer = project.settings.pdfserver;
    }
    if (req.query.from) {
      filesServer = req.query.from;
      delete req.query.from;
    }

    // Create the headers object
    const headers = {
      'x-license-key': getLicenseKey(req),
      'content-type': 'application/json',
    };

    // Pass along the auth token to files server
    if (req.token) {
      if (req.token.user && req.token.form) {
        headers['x-jwt-token'] = formio.auth.getToken({
          form: req.token.form,
          user: req.token.user,
          project: req.token.project
        });
      }
      else {
        headers['x-jwt-token'] = formio.auth.getToken(_.omit(req.token, 'allow'));
      }
    }

    const pdfSrc = _.get(form, 'settings.pdf.src');
    let url = null;

    if (pdfSrc && !req.query.project && !req.params.fileId) {
      // If settings.pdf.src is available, and no custom settings were supplied, use it
      url = `${pdfSrc}/download`;

      // Use pdf as default format
      req.query.format = req.query.format || 'pdf';
    }
    else {
      // Otherwise, fall back to old behavior
      const pdfProject = req.query.project || project._id.toString();
      const fileId = req.params.fileId || 'pdf';

      url = `${filesServer}/pdf/${pdfProject}/file/${fileId}/download`;
    }

    try {
      fetch(url, {
        method: 'POST',
        qs: req.query,
        headers: headers,
        body: JSON.stringify({
          form,
          submission
        }),
      })
        .catch((err) => res.status(400).send(err.message || err))
        .then((response) => {
          if (response.ok) {
            return response.body.pipe(res);
          }
          res.send(null);
        });
    }
    catch (err) {
      res.status(400).send(err.message);
    }
  }
  catch (err) {
    return next(err);
  }
};
