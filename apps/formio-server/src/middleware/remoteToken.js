'use strict';

const jwt = require('jsonwebtoken');
const request = require('request');

module.exports = app => (req, res, next) => {
  if (!app.formio.config.remoteAuth || !req.projectId) {
    return next();
  }
  const token = app.formio.formio.util.getRequestValue(req, 'x-jwt-token');

  // This is NOT a verified token yet. We need to check if it is remote first though.
  let decoded = jwt.decode(token);

  // If there is no origin, pass to regular token handler
  if (!decoded || !decoded.hasOwnProperty('origin')) {
    return next();
  }

  // See if this token is from a remote server.
  if (decoded.origin === app.formio.config.remoteAuth) {
    // Since this is remote, get information about them from the other server.
    request({
      method: 'GET',
      url: app.formio.config.remoteAuth + '/team/project/' + req.projectId + '/access',
      headers: {
        'x-jwt-token': token,
        'Content-Type': 'application/json'
      }
    }, (err, response, body) => {
      if (err || response.statusCode !== 200) {
        return next();
      }
      else {
        const result = JSON.parse(body);
        res.token = response.headers['x-jwt-token'];
        req.token = decoded;
        req.user = decoded.user;
        req.userProject = result.project;
        req.remoteAuth = result;
        return next();
      }
    });
  }
  else {
    // Not the right origin.
    return next();
  }
};
