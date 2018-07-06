'use strict';
const request = require('request');
const FORMIO_FILES_SERVER = process.env.FORMIO_FILES_SERVER || 'https://files.form.io';
module.exports = function(formio) {
  return function(req, res, next) {
    formio.cache.loadPrimaryProject(req, function(err, project) {
      if (err) {
        return next(err);
      }
      const settings = project.settings;
      formio.cache.loadCurrentForm(req, function(err, form) {
        if (err) {
          return next(err);
        }
        formio.cache.loadCurrentSubmission(req, function(err, submission) {
          if (err) {
            return next(err);
          }

          // Allow them to dynamically download from any server.
          let filesServer = settings.pdfserver || FORMIO_FILES_SERVER;
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
            headers['x-jwt-token'] = formio.auth.getToken({
              form: req.token.form,
              user: req.token.user
            });
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
                form: form,
                submission: submission
              }
            }, (err) => {
              if (err) {
                res.status(500).send(err.message);
              }
            }).pipe(res);
          }
          catch (err) {
            res.status(500).send(err.message);
          }
        });
      });
    });
  };
};
