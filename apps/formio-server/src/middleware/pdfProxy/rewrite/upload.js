'use strict';

module.exports = function(app) {
  app.post('/project/:projectId/upload', (req, res, next) => {
    req.url = `/pdf-proxy/pdf/${req.projectId}/file`;
    return next();
  });
};
