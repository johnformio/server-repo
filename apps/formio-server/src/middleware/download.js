'use strict';
const request = require('request');
const FORMIO_FILES_SERVER = process.env.FORMIO_FILES_SERVER || 'https://files.form.io';
const _ = require('lodash');

module.exports = (formio) => (req, res, next) => {
  formio.cache.loadPrimaryProject(req, (err, project) => {
    if (err) {
      return next(err);
    }

    const settings = project.settings;
    const formId = req.query.form || formio.cache.getCurrentFormId(req);

    // Load the provided form.
    formio.cache.loadForm(req, null, formId, (err, form) => {
      if (err) {
        return next(err);
      }

      // Speed up performance by loading all subforms inline to the form.
      formio.cache.loadSubForms(form, req, () => {
        if (err) {
          return next(err);
        }

        // Load the current submission.
        formio.cache.loadCurrentSubmission(req, (err, submission) => {
          if (err) {
            return next(err);
          }

          // Load all subform submissions.
          formio.cache.loadSubSubmissions(form, submission, req, (err) => {
            if (err) {
              return next(err);
            }

            formio.util.removeProtectedFields(form, 'download', submission);

            // Set the files server.
            let filesServer = FORMIO_FILES_SERVER;
            if (process.env.FORMIO_HOSTED && settings.pdfserver) {
              // Allow them to download from any server if it is set to the default.
              filesServer = settings.pdfserver;
            }
            if (req.query.from) {
              filesServer = req.query.from;
              delete req.query.from;
            }

            // Create the headers object.
            const headers = {
              'x-file-token': settings.filetoken
            };

            // Pass along the auth token to files server.
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
          });
        });
      });
    });
  });
};
