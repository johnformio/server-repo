'use strict';

const url = require('url');

module.exports = app => (type, formio) => {
  switch (type) {
    case 'alias':
      // Dynamically set the baseUrl.
      formio.middleware.alias.baseUrl = function(req) {
        const baseUrl = `/project/${req.projectId}`;
        // Save the alias as well.
        req.pathAlias = url.parse(req.url).pathname.substr(baseUrl.length);
        return baseUrl;
      };

      // Add the alias handler.
      app.use(formio.middleware.alias);
      return true;
    case 'config':
      // Do not use core config.json handlers.
      return true;
    case 'params':
      app.use(formio.middleware.params);
      return true;
    case 'token':
      app.use(require('../../middleware/remoteToken')(app));
      app.use(require('../../middleware/aliasToken')(app));
      app.use(formio.middleware.tokenHandler);
      app.use(require('../../middleware/userProject')(app.formio.formio));
      return true;
    case 'logout':
      app.get('/project/:projectId/logout', [
        (req, res, next) => {
          next();
        },
        formio.middleware.tokenHandler,
        require('../../middleware/logout')(app),
        formio.auth.logout,
      ]);
      app.get('/logout', [
        (req, res, next) => {
          next();
        },
        formio.middleware.tokenHandler,
        require('../../middleware/logout')(app),
        formio.auth.logout,
      ]);
      return true;
    case 'getTempToken':
      app.get('/token',
      [
        require('../../middleware/apiKey')(app),
        formio.auth.tempToken
      ]);
      return false;
    case 'current':
      app.get('/current', formio.hook.alter('currentUser', [formio.auth.currentUser]));
      return false;
    case 'access':
      app.get('/access', formio.middleware.accessHandler);
      return false;
    case 'perms':
      app.use(formio.middleware.storageAccessHandler, formio.middleware.permissionHandler);
      return true;
  }

  return false;
};
