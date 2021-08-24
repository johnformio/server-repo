'use strict';

const jwt = require('jsonwebtoken');

module.exports = app => (req, res, next) => {
  const token = app.formio.formio.util.getRequestValue(req, 'x-remote-token');

  // Bypass check if apiKey was provided
  if (req.isAdmin || req.token) {
    return next();
  }

  if (!token || !app.formio.config.remoteSecret) {
    return next();
  }

  jwt.verify(token, app.formio.config.remoteSecret, function(err, decoded) {
    if (err || !decoded) {
      // If something went wrong in decoding, skip the middleware.
      return next();
    }

    // By setting these here it will skip the tokenHandler.
    req.token = decoded;
    req.user = decoded.user;
    req.userProject = decoded.project;
    req.remotePermission = decoded.permission;

    res.token = app.formio.formio.auth.getToken(req.token, app.formio.config.remoteSecret);

    // Set the headers if they haven't been sent yet.
    if (!res.headersSent) {
      const headers = app.formio.formio.hook.alter('accessControlExposeHeaders', 'x-remote-token');
      res.setHeader('Access-Control-Expose-Headers', headers);
      res.setHeader('x-remote-token', res.token);
    }

    return next();
  });
};
