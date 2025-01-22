'use strict';

const debug = require('debug')('formio:pdfproxy');

const rewriteDownload = (req, res, next) => {
  req.url = `/pdf-proxy/${req.url}`;
  debug('Rewrote URL to ', req.url);
  next();
};

module.exports = function(app) {
  // Handle form alias
  app.get('/project/:projectId/:formAlias/submission/:submissionId/download', app.formio.formio.middleware.alias);
  app.post('/project/:projectId/:formAlias/submission/:submissionId/download', app.formio.formio.middleware.alias);

  // Rewrite url
  app.get('/project/:projectId/form/:formId/submission/:submissionId/download', rewriteDownload);
  app.post('/project/:projectId/form/:formId/submission/:submissionId/download', rewriteDownload);
};
