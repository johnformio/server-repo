'use strict';

var Q = require('q');
var _ = require('lodash');

var util = require('formio/src/util/util');

var MAX_TIMESTAMP = 8640000000000000;

// Export the generic openId provider.
module.exports = function(formio) {
  var oauthUtil = require('../util/oauth')(formio);
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
    getTokens: function(req, code, state, redirectURI, next) {
      return oauthUtil.settings(req, this.name)
        .then(function(settings) {
          /* eslint-disable camelcase */
          return util.request({
            method: 'POST',
            json: true,
            url: settings.tokenURI,
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
            throw 'No response from OpenID Provider.';
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
    getUser: function(tokens, settings, next) {
      var accessToken = _.find(tokens, {type: this.name});
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
          'Authorization': 'Bearer ' + accessToken.token,
          'User-Agent': 'form.io/1.0'
        },
        body: null
      })
      .spread(function(response, userInfo) {
        if (!userInfo) {
          var status = response.statusCode;
          throw {
            status: status,
            message: status + ' response from Dropbox: ' + response.statusMessage
          };
        }
        // Make it easier to reference items in userInfo.name
        userInfo = _.merge(userInfo, userInfo.name);
        return userInfo;
      })
      .nodeify(next);
    },

    // Gets user ID from provider user response from getUser()
    getUserId: function(user) {
      return user._id || user.sub;
    },

    // Dropbox tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens: function(req, res, user, next) {
      return Q.reject('Token has been invalidated, please reauthenticate with ' + this.title + '.')
        .nodeify(next);
    }
  };
};
