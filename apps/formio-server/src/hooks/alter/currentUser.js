'use strict';

const _ = require('lodash');
const fetch = require('@formio/node-fetch-http-proxy');

module.exports = (app) => (middleware) => {
  middleware.unshift((req, res, next) => {
    if (!app.formio.formio.twoFa.is2FAuthenticated(req)) {
      return res.status(200).send({
        isTwoFactorAuthenticationRequired: true,
      });
    }
    next();
  });
  middleware.unshift((req, res, next) => {
    // If this is an external token, return the user object directly.
    if (req.token && req.token.external) {
      if (!res.token || !req.token) {
        return res.sendStatus(401);
      }

      // Set the headers if they haven't been sent yet.
      if (!res.headersSent) {
        const headers = app.formio.formio.hook.alter('accessControlExposeHeaders', 'x-jwt-token');
        res.setHeader('Access-Control-Expose-Headers', headers);
        res.setHeader('x-jwt-token', res.token);
      }

      return res.send({
        ...req.token.user,
        isAdmin: req.isAdmin,
      });
    }
    return next();
  });
  middleware.unshift(async (req, res, next) => {
    try {
      const role = await app.formio.formio.hook.alter('getPrimaryProjectAdminRole', req, res);
      req.isAdmin = req.user && req.user.roles && req.user.roles.includes(role);
      return next();
  }
  catch (err) {
   return next();
  }
  });
  middleware.unshift((req, res, next) => {
    app.formio.formio.hook.alter('oAuthResponse', req, res, next);
  });
  middleware.unshift(async (req, res, next) => {
    // Check for a bearer token.
    const authorization = app.formio.formio.util.getHeader(req, 'authorization');

    if (!authorization || req.token) {
      return next();
    }

    try {
      const currentProject = await app.formio.formio.cache.loadCurrentProject(req);
      if (!currentProject) {
        return next();
      }

      // Load the valid roles for this project.
      const roles = await app.formio.formio.resources.role.model.find({
        project: app.formio.formio.util.idToBson(currentProject._id),
        deleted: {$eq: null},
      }).exec();
      // Get a list of valid roles for this project.
      const validRoles = (roles && roles.length) ? _.map(roles, (role) => role._id.toString()) : [];

      // Only continue if oauth settings are set.
      const oauthSettings = _.get(currentProject, 'settings.oauth.openid', false);
      if (!oauthSettings) {
        return next();
      }

      try {
        const response = await fetch(oauthSettings.userInfoURI,{
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Authorization: authorization,
        },
      });
      const data = response.ok ? await response.json() : null;
          // Assign roles based on settings.
          const roles = [];
          _.map(oauthSettings.roles, map => {
            if (
              // Make sure this is a valid role to assign the user.
              (validRoles.indexOf(map.role) !== -1) &&
              (
                !map.claim ||
                _.get(data, map.claim) === map.value ||
                _.includes(_.get(data, map.claim), map.value)
              )
            ) {
              roles.push(map.role);
            }
          });

          const user = {
            _id: data._id || data.sub,
            data,
            roles,
          };
          const formio = app.formio.formio;

          const session = await formio.mongoose.models.session.create({
            project: currentProject._id,
            // form: ssoToken.submission.form,
            submission: user._id,
            source: 'oauth2:token',
          });

          const token = formio.hook.alter('token', {
            external: true,
            user,
            project: {
              _id: currentProject._id.toString(),
            },
          }, '', {session});

          req.user = user;
          req.token = token;
          res.token = formio.auth.getToken(token);
          req['x-jwt-token'] = res.token;

          // Set the headers if they haven't been sent yet.
          if (!res.headersSent) {
            const headers = formio.hook.alter('accessControlExposeHeaders', 'x-jwt-token');
            res.setHeader('Access-Control-Expose-Headers', headers);
            res.setHeader('x-jwt-token', res.token);
          }
          return res.send(user);
        }
        catch (err) {
          return res.status(400).send(err.message || err);
        }
  }
  catch (err) {
    return next();
  }
  });
  return middleware;
};
