'use strict';
const _ = require('lodash');
const moment = require('moment');
const URL = require('url').URL;
const {ClientCredentials} = require('simple-oauth2');
/**
 * The oauthM2MHandler middleware.
 *
 * This middleware is used for adding and checking oauth2 machine to machine code.
 *
 * @param cache
 * @returns {Function}
 */
module.exports = function(formio) {
  return function(req, res, next) {
    if (!formio.config.enableOauthM2M) {
      return next();
    }

    const m2m = _.get(req, 'userProject.settings.oauth.oauthM2M');

    if (m2m) {
      const m2mToken = _.get(req.token, 'm2mToken');

      if (m2mToken && m2mToken.expires_at && moment.utc().isBefore(m2mToken.expires_at)) {
        return next();
      }

      const {
        clientId,
        clientSecret,
        tokenURI
      } = m2m;

      if (!clientId || !clientSecret || !tokenURI) {
        return next();
      }

      const url = new URL(tokenURI);
      const tokenHost = url.origin;
      const tokenPath = url.pathname;
      const provider = new ClientCredentials({
        client: {
          id: clientId,
          secret: clientSecret,
        },
        auth: {
          tokenHost,
          tokenPath,
        }
      });

      return provider.getToken().then(accessToken => accessToken.token)
        .then((token) => {
          if (!token) {
            throw 'No response from OAuth Provider.';
          }
          if (token.error) {
            throw token.error_description;
          }

          req.token = {
            ...req.token,
            m2mToken: token,
          };

          res.token = formio.formio.auth.getToken(req.token);
          req['x-jwt-token'] = res.token;

          if (!res.headersSent) {
            const headers = formio.formio.hook.alter('accessControlExposeHeaders', 'x-jwt-token');
            res.setHeader('Access-Control-Expose-Headers', headers);
            res.setHeader('x-m2m-token', token.access_token);
          }

          next();
        })
        .catch(next);
    }
    else {
      return next();
    }
  };
};
