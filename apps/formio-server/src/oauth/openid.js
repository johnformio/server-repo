'use strict';

const Q = require('q');
const _ = require('lodash');
const URL = require('url').URL;
const {AuthorizationCode} = require('simple-oauth2');
const debug = require('debug')('formio:openid');

const fetch = require('formio/src/util/fetch');

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

    userInfoURI: '',

    redirectURI: '',

    idPath: '',

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
          userInfoURI
        }) => {
          /* eslint-disable camelcase */
          const url = new URL(tokenURI);
          const tokenHost = url.origin;
          const tokenPath = url.pathname;
          this.userInfoURI = userInfoURI;
          const provider = new AuthorizationCode({
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

          return provider.getToken({
            code,
            redirect_uri: redirectURI
          }).then(accessToken => accessToken.token);

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
              userInfo: this.userInfoURI,
              token: token.access_token || token.id_token || token.token,
              exp: new Date(MAX_TIMESTAMP),
            }
          ];
        })
        .nodeify(next);
    },

    // Gets user information from oauth access token
    // Returns a promise, or you can provide the next callback arg
    async getUser(tokens, settings, next) {
      const accessToken = _.find(tokens, {type: this.name});
      if (!accessToken) {
        throw 'No access token found';
      }
      const response = await fetch(accessToken.userInfo, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken.token}`,
          'User-Agent': 'form.io/1.0',
        },
      });

      let userInfo = null;
      if (response.ok) {
        userInfo = await response.json();
      }

      if (!userInfo) {
        throw 'No response from OpenID Provider.';
      }

      return _.isObject(userInfo.name) ? {
        ...userInfo,
        ...userInfo.name,
      } : userInfo;
    },

    // Gets user ID from provider user response from getUser()
    async getUserId(user, req) {
      let idPath = null;

      try {
        const settings = await  oauthUtil.settings(req, this.name) || {};
        idPath = _.get(settings, 'idPath');
      }
      // eslint-disable-next-line no-empty
      catch (error) {
        debug(error);
      }

      let id = null;

      if (idPath) {
        id = _.get(user, idPath);
      }

      return id || user._id || user.sub;
    },

    async getUserEmail(user, req) {
      let emailPath = null;

      try {
        const settings = await  oauthUtil.settings(req, this.name) || {};
        emailPath = _.get(settings, 'emailPath');
      }
      catch (error) {
        debug(error);
      }

      let email = null;

      if (emailPath) {
        email = _.get(user, emailPath).toLowerCase();
      }

      return email || user.email.toLowerCase();
    },

    // OpenID tokens have no expiration date. If it is invalidated it means they have disabled the app.
    refreshTokens(req, res, user, next) {
      return Q.reject(`Token has been invalidated, please reauthenticate with ${this.title}.`)
        .nodeify(next);
    },
  };
};
