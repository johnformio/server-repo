'use strict';

const _ = require('lodash');
const fetch = require('formio/src/util/fetch');

module.exports = (app) => (middleware) => {
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

    if (!authorization || req.token) {
      return next();
    }

    app.formio.formio.cache.loadCurrentProject(req, (err, currentProject) => {
      if (err || !currentProject) {
        return next();
      }

      // Load the valid roles for this project.
      app.formio.formio.resources.role.model.find({
        project: currentProject._id,
        deleted: {$eq: null},
      }).exec((err, roles) => {
        if (err) {
          return next();
        }

        // Get a list of valid roles for this project.
        const validRoles = (roles && roles.length) ? _.map(roles, (role) => role._id.toString()) : [];
        currentProject = currentProject.toObject();

        // Only continue if oauth settings are set.
        const oauthSettings = _.get(currentProject, 'settings.oauth.openid', false);
        if (!oauthSettings) {
          return next();
        }

        fetch(oauthSettings.userInfoURI,{
          method: 'GET',
          headers: {
            Authorization: authorization,
          },
        })
          .then((response) => response.ok ? response.json() : null)
          .then((data) => {
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

            formio.mongoose.models.session.create({
              project: currentProject._id,
              // form: ssoToken.submission.form,
              submission: user._id,
              source: 'oauth2:token',
            })
              .then((session) => {
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
                  res.setHeader('Access-Control-Expose-Headers', 'x-jwt-token');
                  res.setHeader('x-jwt-token', res.token);
                }
                return res.send(user);
              });
          })
          .catch((err) => res.status(400).send(err.message || err));
      });
    });
  });
  return middleware;
};
