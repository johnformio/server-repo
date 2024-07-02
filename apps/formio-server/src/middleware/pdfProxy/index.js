'use strict';

module.exports = function(app) {
  // Handle subdomain project aliases
  app.all('/project/:projectId/pdf-proxy/*', (req, res, next) => {
    req.url = req.url.replace(`/project/${req.params.projectId}`, '');
    return next();
  });
  // Mount backward compatibility endpoints
  require('./rewrite/upload')(app);
  require('./rewrite/changelog')(app);
  require('./rewrite/download')(app);

  // Mount PDF server proxy
  app.use('/pdf-proxy', [
    // Mount auth bypass middleware
    require('./bypass'),
    (req, res, next) => {
      if (req.headers['x-admin-key'] === process.env.ADMIN_KEY) {
        req.isAdmin = true;
      }
      next();
    },
    require('../apiKey')(app.formio.formio),
    require('../remoteToken')(app),
    require('../aliasToken')(app),
    app.formio.formio.middleware.tokenHandler,
    app.formio.formio.middleware.params,
    (req, res, next) => {
      if (new RegExp('/changelog').test(req.url)) {
        req.url = req.url.replace('/changelog', '');
      }
      next();
    },
    (req, res, next) => {
      if (req.bypass) {
        return next();
      }
      if (!req.user && !req.isAdmin) {
        return res.sendStatus(401);
      }
      next();
    },
    require('./router')(app),
  ]);
};
