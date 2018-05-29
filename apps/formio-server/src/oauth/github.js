'use strict';

const Q = require('q');
const _ = require('lodash');

const util = require('formio/src/util/util');

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
    getTokens(req, code, state, redirectURI, next) {
      return oauthUtil.settings(req, this.name)
      .then(function(settings) {
        /* eslint-disable camelcase */
        return util.request({
          method: 'POST',
          json: true,
          url: 'https://github.com/login/oauth/access_token',
          body: {
            client_id: settings.clientId,
            client_secret: settings.clientSecret,
            code: code,
            state: state
          }
        });
        /* eslint-enable camelcase */
      })
      .spread(function(response, body) {
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
      }.bind(this))
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
        url: 'https://api.github.com/user',
        json: true,
        headers: {
          Authorization: `token ${accessToken.token}`,
          'User-Agent': 'formio'
        }
      })
      .spread(function(response, userInfo) {
        if (!userInfo) {
          throw 'No response from GitHub.';
        }
        if (userInfo.email) {
          return userInfo;
        }
        else {
          // GitHub users can make their email private. If they do so,
          // we have to explicitly request the email endpoint to get an email
          return util.request({
            method: 'GET',
            url: 'https://api.github.com/user/emails',
            json: true,
            headers: {
              Authorization: `token ${accessToken.token}`,
              'User-Agent': 'formio'
            }
          })
          .spread(function(response, body) {
            if (!body) {
              throw 'No response from GitHub';
            }
            const primaryEmail = _.find(body, 'primary');
            if (!primaryEmail) {
              throw 'Could not retrieve primary email';
            }
            userInfo.email = primaryEmail.email;
            return userInfo;
          });
        }
      })
      .nodeify(next);
    },

    // Gets user ID from provider user response from getUser()
    getUserId(user) {
      return user.id;
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
