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
          request({
            method: 'GET',
            url: FORMIO_FILES_SERVER + '/pdf/' + req.params.projectId + '/file/' + req.params.fileId + '/download',
            headers: {
              'x-form': JSON.stringify(form),
              'x-submission': JSON.stringify(submission),
              'x-file-token': settings.filetoken
            }
          }).pipe(res);
        });
      });
    });
  };
};
