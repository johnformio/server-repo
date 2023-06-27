'use strict';

const util = require('../../../util/util');

module.exports = function(app) {
  // Handle form alias
  app.get('/project/:projectId/:formAlias/submission/:submissionId/download/changelog', app.formio.formio.middleware.alias);

  // Load changelog and rewrite url
  app.get('/project/:projectId/form/:formId/submission/:submissionId/download/changelog',
    (req, res, next) => {
      app.formio.formio.cache.loadCurrentForm(req, (err, currentForm) => {
        return util.getSubmissionRevisionModel(app.formio.formio, req, currentForm, false, next);
      });
    },
    require('../../submissionChangeLog')(app),
    (req, res, next) => {
      req.url = `/pdf-proxy/${req.url}`;
      return next();
    }
  );
};
