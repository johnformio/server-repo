'use strict';

var Q = require('q');
var _ = require('lodash');

var util = require('formio/src/util/util');

var MAX_TIMESTAMP = 8640000000000000;

var debug = require('debug')('formio:action:oauth');

// Export the Google oauth provider.
module.exports = function(formio) {
  var oauthUtil = require('../util/oauth')(formio);
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
    getTokens: function(req, code, state, redirectURI, next) {
      return oauthUtil.settings(req, this.name)
        .then(function(settings) {
          /* eslint-disable camelcase */
          return util.request({
            method: 'POST',
            json: true,
            url: 'https://accounts.google.com/o/oauth2/token',
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
          debug(body);
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
        }.bind(this))
        .nodeify(next);
    },

    // Gets user information from oauth access token
    // Returns a promise, or you can provide the next callback arg
    getUser: function(tokens, next) {
      var accessToken = _.find(tokens, {type: this.name});
      if (!accessToken) {
        return Q.reject('No access token found');
      }
      /* eslint-disable camelcase */
      return util.request({
        method: 'GET',
        url: 'https://www.googleapis.com/oauth2/v1/userinfo',
        json: true,
        qs: {
          access_token: accessToken.token
        }
      })
      .spread(function(response, userInfo) {
        if (!userInfo) {
          var status = response.statusCode;
          throw {
            status: status,
            message: status + ' response from Google: ' + response.statusMessage
          };
        }
        // Make it easier to reference items in userInfo.name

        userInfo = _.merge(userInfo, userInfo.name);
        debug(userInfo);
        return userInfo;
      })
      .nodeify(next);
      /* eslint-enable camelcase */
    },

    // Gets user ID from provider user response from getUser()
    getUserId: function(user) {
      return user.id;
    },

    // Google tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens: function(req, res, user, next) {
      return Q.reject('Token has been invalidated, please reauthenticate with ' + this.title + '.')
        .nodeify(next);
    }
  };
};
