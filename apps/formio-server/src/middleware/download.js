'use strict';
const request = require('request');
const FORMIO_FILES_SERVER = process.env.FORMIO_FILES_SERVER || 'https://files.form.io';
const _ = require('lodash');
const Promise = require('bluebird');

module.exports = (formio) => async(req, res, next) => {
  Promise.promisifyAll(formio.cache, {context: formio.cache});

  try {
    // Load project
    const project = await formio.cache.loadPrimaryProjectAsync(req);

    // Load the provided form
    const formId = req.query.form || formio.cache.getCurrentFormId(req);
    const form = await formio.cache.loadFormAsync(req, null, formId);

    // Speed up performance by loading all subforms inline to the form
    await formio.cache.loadSubFormsAsync(form, req);

    // Load the current submission
    const submission = await formio.cache.loadCurrentSubmissionAsync(req);

    // Load all subform submissions
    await formio.cache.loadSubSubmissionsAsync(form, submission, req);

    // Remove protected fields
    formio.util.removeProtectedFields(form, 'download', submission);

    // Set the files server
    let filesServer = FORMIO_FILES_SERVER;
    if (process.env.FORMIO_HOSTED && project.settings.pdfserver) {
      // Allow them to download from any server if it is set to the default
      filesServer = project.settings.pdfserver;
    }
    if (req.query.from) {
      filesServer = req.query.from;
      delete req.query.from;
    }

    // Create the headers object
    const headers = {'x-file-token': project.settings.filetoken};

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

    const pdfProject = req.query.project ? req.query.project : project._id.toString();
    const fileId = req.params.fileId || 'pdf';

    try {
      request({
        method: 'POST',
        url: `${filesServer}/pdf/${pdfProject}/file/${fileId}/download`,
        qs: req.query,
        headers: headers,
        json: true,
        rejectUnauthorized: false,
        body: {
          form,
          submission
        }
      }, (err) => {
        if (err) {
          res.status(400).send(err.message);
        }
      }).pipe(res);
    }
    catch (err) {
      res.status(400).send(err.message);
    }
  }
  catch (err) {
    return next(err);
  }
};
