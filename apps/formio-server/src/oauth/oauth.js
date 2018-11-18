'use strict';

const _ = require('lodash');

module.exports = function(formio) {
  // Export the oauth providers.
  return {
    providers: {
      openid: require('./openid')(formio),
      github: require('./github')(formio),
      facebook: require('./facebook')(formio),
      office365: require('./office365')(formio),
      dropbox: require('./dropbox')(formio),
      google: require('./google')(formio),
      linkedin: require('./linkedin')(formio)
    },

    // Gets user token for a provider, and attempts to refresh it
    // if it is expired
    // Returns a promise, or you can provide the next callback arg
    getUserToken(req, res, providerName, userId, next) {
      const provider = this.providers[providerName];
      if (!provider) {
        return Promise.reject('Invalid provider name');
      }

      return new Promise((resolve, reject) => {
        formio.resources.submission.model.findOne({_id: userId}).exec((err, user) => {
          if (err) {
            reject(err);
            return next(err);
          }

          if (!user) {
            err = 'Could not find user';
            reject(err);
            return next(err);
          }
          const accessToken = _.find(user.externalTokens, {type: provider.name});
          if (!accessToken) {
            err = `No access token available. Make sure you have authenticated with ${provider.title}.`;
            reject(err);
            return next(err);
          }

          if (new Date() < accessToken.exp) {
            resolve(accessToken.token);
            return next(null, accessToken.token);
          }

          return provider.refreshTokens(req, res, user).then(function(tokens) {
            user.set('externalTokens',
              _(tokens).concat(user.externalTokens).uniq('type').value()
            );
            user.save().then(() => {
              const token = _.find(tokens, {type: provider.name});
              if (!token) {
                err = `No access token available. Make sure you have authenticated with ${provider.title}.`;
                reject(err);
                return next(err);
              }
              resolve(token.token);
              return next(null, token.token);
            });
          });
        });
      });
    }
  };
};
