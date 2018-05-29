'use strict';

const jwt = require('jsonwebtoken');

module.exports = app => (req, res, next) => {
  const token = app.formio.formio.util.getRequestValue(req, 'x-remote-token');

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

    // TODO: return a new token to renew.
    res.token = req.token;
    return next();
  });
};
