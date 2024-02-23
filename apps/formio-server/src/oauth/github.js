'use strict';

const Q = require('q');
const _ = require('lodash');

const fetch = require('@formio/node-fetch-http-proxy');

const MAX_TIMESTAMP = 8640000000000000;

// Export the Github oauth provider.
module.exports = function(formio) {
  const oauthUtil = require('../util/oauth')(formio);
  return {
    // Name of the oauth provider (used as property name in settings)
    name: 'github',

    // Display name of the oauth provider
    title: 'GitHub',

    // URL to redirect user browser to
    authURI: 'https://github.com/login/oauth/authorize',

    scope: 'user:email',

    // List of field data that can be autofilled from user info API request
    autofillFields: [
      {
        title: 'Email',
        name: 'email'
      },
      {
        title: 'Username',
        name: 'login'
      },
      {
        title: 'Name',
        name: 'name'
      }
    ],

    // Exchanges authentication code for access tokens
    // Returns a promise, or you can provide the next callback arg
    // Resolves with array of tokens defined like externalTokenSchema
    async getTokens(req, code, state, redirectURI) {
      const settings = await oauthUtil.settings(req, this.name);

      /* eslint-disable camelcase */
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          code: code,
          state: state
        }),
      });
      /* eslint-enable camelcase */

      let body = null;
      if (response.ok) {
        body = await response.json();
      }

      if (!body) {
        throw 'No response from GitHub.';
      }
      if (body.error) {
        throw body.error;
      }

      return [
        {
          type: this.name,
          token: body.access_token,
          exp: new Date(MAX_TIMESTAMP) // Github tokens never expire
        }
      ];
    },

    // Gets user information from oauth access token
    // Returns a promise, or you can provide the next callback arg
    async getUser(tokens, settings) {
      const accessToken = _.find(tokens, {type: this.name});
      if (!accessToken) {
        throw 'No access token found';
      }
      const response = await fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          'Authorization': `token ${accessToken.token}`,
          'User-Agent': 'formio',
          'accept': 'application/json',
        }
      });

      let userInfo = null;
      if (response.ok) {
        userInfo = await response.json();
      }

      if (!userInfo) {
        throw 'No response from GitHub.';
      }
      if (userInfo.email) {
        return userInfo;
      }
      else {
        // GitHub users can make their email private. If they do so,
        // we have to explicitly request the email endpoint to get an email
        const response = await fetch('https://api.github.com/user/emails', {
          method: 'GET',
          headers: {
            Authorization: `token ${accessToken.token}`,
            'User-Agent': 'formio'
          }
        });

        let body = null;
        if (response.ok) {
          body = await response.json();
        }

        if (!body) {
          throw 'No response from GitHub';
        }

        const primaryEmail = _.find(body, 'primary');
        if (!primaryEmail) {
          throw 'Could not retrieve primary email';
        }
        userInfo.email = primaryEmail.email;
        return userInfo;
      }
    },

    // Gets user ID from provider user response from getUser()
    getUserId(user) {
      return Promise.resolve(user.id);
    },

    getUserEmail(user, req) {
      return Promise.resolve(user.email.toLowerCase());
    },

    // This should never get called, since GitHub tokens don't expire
    // Returns a promise, or you can provide the next callback arg
    refreshTokens(req, res, user, next) {
      return Q.reject(
        'GitHub tokens don\'t expire for another 200,000 years. Either something went wrong or the end times fallen '
        + 'upon us.'
      ).nodeify(next);
    }
  };
};
