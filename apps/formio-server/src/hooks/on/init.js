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
      app.get('/logout', formio.auth.logout);
      return false;
    case 'getTempToken':
      app.get('/token', formio.auth.tempToken);
      return false;
    case 'current':
      app.get('/current', (req, res, next) => {
        // If this is an external token, return the user object directly.
        if (req.token && req.token.external) {
          if (!res.token || !req.token) {
            return res.sendStatus(401);
          }

          // Set the headers if they haven't been sent yet.
          if (!res.headersSent) {
            res.setHeader('Access-Control-Expose-Headers', 'x-jwt-token');
            res.setHeader('x-jwt-token', res.token);
          }

          return res.send(req.token.user);
        }
        return formio.auth.currentUser(req, res, next);
      });
      return false;
    case 'access':
      app.get('/access', formio.middleware.accessHandler);
      return false;
    case 'perms':
      app.use(formio.middleware.permissionHandler);
      return true;
  }

  return false;
};

