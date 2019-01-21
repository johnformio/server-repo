'use strict';

const Q = require('q');
const _ = require('lodash');

const util = require('formio/src/util/util');

const MAX_TIMESTAMP = 8640000000000000;

// Export the Dropbox oauth provider.
module.exports = function(formio) {
  const oauthUtil = require('../util/oauth')(formio);
  return {
    // Name of the oauth provider (used as property name in settings)
    name: 'dropbox',

    // Display name of the oauth provider
    title: 'Dropbox',

    authURI: 'https://www.dropbox.com/1/oauth2/authorize',

    scope: '',

    isAvailable(settings) {
      return formio.config.dropboxKey && formio.config.dropboxSecret;
    },

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
        name: 'familiar_name'
      },
      {
        title: 'Display Name',
        name: 'display_name'
      }
    ],

    // Exchanges authentication code for auth token
    // Returns a promise, or you can provide the next callback arg
    // Resolves with array of tokens defined like externalTokenSchema
    getTokens(req, code, state, redirectURI, next) {
      return oauthUtil.settings(req, this.name)
        .then(function(settings) {
          /* eslint-disable camelcase */
          return util.request({
            method: 'POST',
            json: true,
            url: 'https://api.dropboxapi.com/1/oauth2/token',
            form: {
              client_id: settings.clientId,
              client_secret: settings.clientSecret,
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: redirectURI
            }
          });
          /* eslint-enable camelcase */
        })
        .spread(function(response, body) {
          if (!body) {
            throw 'No response from Dropbox.';
          }
          if (body.error) {
            throw body.error_description;
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
        method: 'POST',
        url: 'https://api.dropboxapi.com/2/users/get_current_account',
        json: true,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken.token}`,
          'User-Agent': 'form.io/1.0'
        },
        body: null
      })
      .spread(function(response, userInfo) {
        if (!userInfo) {
          const status = response ? response.statusCode : 400;
          throw {
            status: status,
            message: `${status} response from Dropbox: ${response.statusMessage}`
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
      return user.account_id;
    },

    // Dropbox tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens(req, res, user, next) {
      return Q.reject(`Token has been invalidated, please reauthenticate with ${this.title}.`)
        .nodeify(next);
    }
  };
};
