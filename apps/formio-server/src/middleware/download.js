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
          var filesServer = req.query.from || FORMIO_FILES_SERVER;
          request({
            method: 'POST',
            url: filesServer + '/pdf/' + req.params.projectId + '/file/' + req.params.fileId + '/download',
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
