var request = require('request');
var FORMIO_FILES_SERVER = process.env.FORMIO_FILES_SERVER;
module.exports = function(formio) {
  return function(req, res, next) {
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
          url: FORMIO_FILES_SERVER + '/pdf/' + req.params.projectId + '/file/' + req.params.fileId + '.pdf',
          headers: {
            'x-form': JSON.stringify(form),
            'x-submission': JSON.stringify(submission),
            'x-jwt-token': req.headers['x-jwt-token']
          }
        }).pipe(res);
      });
    });
  };
};
