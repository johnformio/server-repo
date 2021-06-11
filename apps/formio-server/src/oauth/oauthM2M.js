'use strict';

const Q = require('q');
const _ = require('lodash');
const URL = require('url').URL;
const {ClientCredentials} = require('simple-oauth2');

const fetch = require('formio/src/util/fetch');

const MAX_TIMESTAMP = 8640000000000000;

// Export the generic openId provider.
module.exports = (formio) => {
  const oauthUtil = require('../util/oauth')(formio);

  return {
    // Name of the oauth provider (used as property name in settings)
    name: 'oauthM2M',

    // Display name of the oauth provider
    title: 'OAuth 2.0 machine to machine',

    authURI: '',

    scope: '',

    userInfoURI: '',

    redirectURI: '',

    // List of field data that can be autofilled from user info API request
    autofillFields: [],

    // Exchanges authentication code for auth token
    // Returns a promise, or you can provide the next callback arg
    // Resolves with array of tokens defined like externalTokenSchema
    getTokens(req, code, state, redirectURI, next) {
      return oauthUtil.settings(req, this.name)
      .then(({
        clientId,
        clientSecret,
        tokenURI
      }) => {
        /* eslint-disable camelcase */
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

        return provider.getToken({
          code,
          redirect_uri: redirectURI,
        }).then(accessToken => accessToken.token);
        /* eslint-enable camelcase */
      })
      .then((token) => {
        if (!token) {
          throw 'No response from OAuth Provider.';
        }
        if (token.error) {
          throw token.error_description;
        }
        return [
          // token

        ];
      })
      .nodeify(next);
    },

    // OpenID tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens(req, res, user, next) {
      return Q.reject(`Token has been invalidated, please reauthenticate with ${this.title}.`)
        .nodeify(next);
    },
  };
};
