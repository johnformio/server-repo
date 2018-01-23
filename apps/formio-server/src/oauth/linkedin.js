'use strict';

const Q = require('q');
const _ = require('lodash');

const util = require('formio/src/util/util');

const MAX_TIMESTAMP = 8640000000000000;

// Export the LinkedIn oauth provider.
module.exports = function(formio) {
  const oauthUtil = require('../util/oauth')(formio);
  return {
    // Name of the oauth provider (used as property name in settings)
    name: 'linkedin',

    // Display name of the oauth provider
    title: 'LinkedIn ',

    authURI: 'https://www.linkedin.com/uas/oauth2/authorization',
    scope:'r_basicprofile',

    // List of field data that can be autofilled from user info API request
    autofillFields: [
      {
        title: 'First Name',
        name: 'firstName'
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
            url: 'https://www.linkedin.com/uas/oauth2/accessToken',
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
            throw 'No response from LinkedIn.';
          }
          if (body.error) {
            throw body.error_description;
          }
          return [
            {
              type: this.name,
              token: body.access_token,
              exp: new Date(MAX_TIMESTAMP) // LinkedIn tokens never expire
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
      /* eslint-disable camelcase */
      return util.request({
        method: 'GET',
        url: 'https://api.linkedin.com/v1/people/~',
        json: true,
        qs: {
          fields: 'id,first-name,last-name,headline,picture-url',
          oauth2_access_token: accessToken.token,
          format:'json'
        },
        body:null
      })
      .spread(function(response, userInfo) {
        if (!userInfo) {
          const status = response.statusCode;
          throw {
            status: status,
            message: `${status} response from LinkedIn: ${response.statusMessage}`
          };
        }
        return userInfo;
      })
      .nodeify(next);
      /* eslint-enable camelcase */
    },

    // Gets user ID from provider user response from getUser()
    getUserId(user) {
      return user.id;
    },

    // LinkedIn tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens(req, res, user, next) {
      return Q.reject(`Token has been invalidated, please reauthenticate with ${this.title}.`)
        .nodeify(next);
    }
  };
};
