'use strict';

const _ = require('lodash');
const request = require('request');

module.exports = app => (middleware) => {
  middleware.unshift((req, res, next) => {
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
    return next();
  });
  middleware.unshift((req, res, next) => {
    // Check for a bearer token.
    const authorization = app.formio.formio.util.getHeader(req, 'authorization');

    if (!authorization) {
      return next();
    }

    app.formio.formio.cache.loadCurrentProject(req, function(err, currentProject) {
      if (err || !currentProject) {
        return next();
      }

      currentProject = currentProject.toObject();

      // Only continue if oauth settings are set.
      const oauthSettings = _.get(currentProject, 'settings.oauth.openid', false);
      if (!oauthSettings) {
        return next();
      }

      request({
        method: 'GET',
        uri: oauthSettings.userInfoURI,
        headers: {
          Authorization: authorization
        }
      }, (err, response) => {
        if (err) {
          res.status(400).send(err);
        }

        try {
          const data = JSON.parse(response.body);

          // Assign roles based on settings.
          const roles = [];
          oauthSettings.roles.map(map => {
            if (!map.claim ||
              _.get(data, map.claim) === map.value ||
              _.includes(_.get(data, map.claim), map.value)
            ) {
              roles.push(map.role);
            }
          });

          const user = {
            _id: data._id || data.sub,
            data,
            roles
          };

          const token = {
            external: true,
            user,
            // form: {
            //   _id: req.currentForm._id.toString()
            // },
            project: {
              _id: currentProject._id.toString()
            },
            externalToken: authorization.replace(/^Bearer/, "")
          };

          req.user = user;
          req.token = token;
          res.token = app.formio.formio.auth.getToken(token);
          req['x-jwt-token'] = res.token;

          // Set the headers if they haven't been sent yet.
          if (!res.headersSent) {
            res.setHeader('Access-Control-Expose-Headers', 'x-jwt-token');
            res.setHeader('x-jwt-token', res.token);
          }
          return res.send(user);
        }
        catch (err) {
          res.status(400).send(err);
        }
      });
    });
  });
  return middleware;
};
