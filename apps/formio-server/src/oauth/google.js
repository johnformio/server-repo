'use strict';

const Q = require('q');
const _ = require('lodash');

const fetch = require('@formio/node-fetch-http-proxy');

const MAX_TIMESTAMP = 8640000000000000;

// Export the Google oauth provider.
module.exports = function(formio) {
  const oauthUtil = require('../util/oauth')(formio);
  return {
    // Name of the oauth provider (used as property name in settings)
    name: 'google',

    // Display name of the oauth provider
    title: 'Google',

    authURI: 'https://accounts.google.com/o/oauth2/auth',

    scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',

    // List of field data that can be autofilled from user info API request
    autofillFields: [
      {
        title: 'Email',
        name: 'email'
      },
      {
        title: 'First Name',
        name: 'given_name'
      },
      {
        title: 'Last Name',
        name: 'family_name'
      },
      {
        title: 'Display Name',
        name: 'name'
      }
    ],

    // Exchanges authentication code for auth token
    // Returns a promise, or you can provide the next callback arg
    // Resolves with array of tokens defined like externalTokenSchema
    async getTokens(req, code, state, redirectURI) {
      const settings = await oauthUtil.settings(req, this.name);

      /* eslint-disable camelcase */
      const response = await fetch('https://accounts.google.com/o/oauth2/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          grant_type: 'authorization_code',
          code: decodeURIComponent(code),
          redirect_uri: redirectURI
        }),
      });
      /* eslint-enable camelcase */

      let body = null;
      if (response.ok) {
        body = await response.json();
      }

      if (!body) {
        throw 'No response from Google.';
      }
      if (body.error) {
        throw body.error_description;
      }

      return [
        {
          type: this.name,
          token: body.access_token,
          exp: new Date(MAX_TIMESTAMP) // google tokens never expire
        }
      ];
    },

    // Gets user information from oauth access token
    // Returns a promise, or you can provide the next callback arg
    async getUser(tokens, settings, next) {
      const accessToken = _.find(tokens, {type: this.name});
      if (!accessToken) {
        throw 'No access token found';
      }
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        method: 'GET',
        qs: {
          // eslint-disable-next-line camelcase
          access_token: accessToken.token
        }
      });

      let userInfo = null;
      if (response.ok) {
        userInfo = await response.json();
      }

      if (!userInfo) {
        throw 'No response from Google.';
      }

      return {
        ...userInfo,
        ...userInfo.name,
      };
    },

    // Gets user ID from provider user response from getUser()
    getUserId(user) {
      return Promise.resolve(user.id);
    },

    getUserEmail(user, req) {
      return Promise.resolve(user.email.toLowerCase());
    },

    // Google tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens(req, res, user, next) {
      return Q.reject(`Token has been invalidated, please reauthenticate with ${this.title}.`)
        .nodeify(next);
    }
  };
};
