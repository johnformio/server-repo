'use strict';
var request = require('request');
var FORMIO_FILES_SERVER = process.env.FORMIO_FILES_SERVER || 'https://files.form.io';
module.exports = function(formio) {
  var cache = require('../cache/cache')(formio);
  return function(req, res, next) {
    cache.loadCurrentProject(req, function(err, project) {
      if (err) {
        return next(err);
      }
      let settings = project.settings;
      formio.cache.loadCurrentForm(req, function(err, form) {
        if (err) {
          return next(err);
        }
        formio.cache.loadCurrentSubmission(req, function(err, submission) {
          if (err) {
            return next(err);
          }

          // Allow them to dynamically download from any server.
          var filesServer = FORMIO_FILES_SERVER;
          if (req.query.from) {
            filesServer = req.query.from;
            delete req.query.from;
          }

          let fileId = req.params.fileId || 'pdf';

          request({
            method: 'POST',
            url: filesServer + '/pdf/' + req.params.projectId + '/file/' + fileId + '/download',
            qs: req.query,
            headers: {
              'x-file-token': settings.filetoken
            },
            json: true,
            body: {
              form: form,
              submission: submission
            }
          }).pipe(res);
        });
      });
    });
  };
};
