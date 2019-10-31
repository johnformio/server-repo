'use strict';

const Q = require('q');
const _ = require('lodash');
const oauth2 = require('simple-oauth2');

const util = require('formio/src/util/util');

const MAX_TIMESTAMP = 8640000000000000;

// Export the generic openId provider.
module.exports = (formio) => {
  const oauthUtil = require('../util/oauth')(formio);

  return {
    // Name of the oauth provider (used as property name in settings)
    name: 'openid',

    // Display name of the oauth provider
    title: 'OpenID',

    authURI: '',

    scope: '',

    // List of field data that can be autofilled from user info API request
    autofillFields: [],

    // Exchanges authentication code for auth token
    // Returns a promise, or you can provide the next callback arg
    // Resolves with array of tokens defined like externalTokenSchema
    getTokens(req, code, state, redirectURI, next) {
      return oauthUtil.settings(req, this.name)
        .then(({
          authorizationMethod = 'body',
          clientId,
          clientSecret,
          tokenURI,
        }) => {
          /* eslint-disable camelcase */
          const uriPaths = tokenURI.split('/');
          const tokenHost = _.initial(uriPaths).join('/');
          const tokenPath = `/${_.last(uriPaths)}`;
          const provider = oauth2.create({
            client: {
              id: clientId,
              secret: clientSecret,
            },
            auth: {
              tokenHost,
              tokenPath,
            },
            options: {
              authorizationMethod,
            },
          });

          return provider.authorizationCode.getToken({
            code,
            redirect_uri: redirectURI,
          });
          /* eslint-enable camelcase */
        })
        .then((token) => {
          if (!token) {
            throw 'No response from OpenID Provider.';
          }
          if (token.error) {
            throw token.error_description;
          }
          return [
            {
              type: this.name,
              token: token.access_token,
              exp: new Date(MAX_TIMESTAMP),
            }
          ];
        })
        .nodeify(next);
    },

    // Gets user information from oauth access token
    // Returns a promise, or you can provide the next callback arg
    getUser(tokens, settings, next) {
      const accessToken = _.find(tokens, {type: this.name});
      if (!accessToken) {
        return Q.reject('No access token found');
      }
      return util.request({
        method: 'GET',
        url: settings.userInfoURI,
        json: true,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken.token}`,
          'User-Agent': 'form.io/1.0',
        },
        body: null,
      })
      .spread((response, userInfo) => {
        if (!userInfo) {
          const status = 400;
          throw {
            status: status,
            message: `${status} response from OpenID Provider: ${response.statusMessage}`,
          };
        }
        // Make it easier to reference items in userInfo.name
        userInfo = _.merge(userInfo, userInfo.name);
        return userInfo;
      })
      .nodeify(next);
    },

    // Gets user ID from provider user response from getUser()
    getUserId(user) {
      return user._id || user.sub;
    },

    // OpenID tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens(req, res, user, next) {
      return Q.reject(`Token has been invalidated, please reauthenticate with ${this.title}.`)
        .nodeify(next);
    },
  };
};
