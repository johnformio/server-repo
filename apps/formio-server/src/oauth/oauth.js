'use strict';

const _ = require('lodash');

module.exports = function(formio) {
  // Export the oauth providers.
  return {
    providers: {
      openid: require('./openid')(formio),
      github: require('./github')(formio),
      google: require('./google')(formio)
    },

    // Gets user token for a provider, and attempts to refresh it
    // if it is expired
    // Returns a promise, or you can provide the next callback arg
    getUserToken(req, res, providerName, userId, next) {
      const provider = this.providers[providerName];
      if (!provider) {
        return Promise.reject('Invalid provider name');
      }

      return formio.resources.submission.model.findOne({_id: userId}).then((user) => {
        if (!user) {
          throw 'Could not find user';
        }
        const accessToken = _.find(user.externalTokens, {type: provider.name});
        if (!accessToken) {
          throw `No access token available. Make sure you have authenticated with ${provider.title}.`;
        }

        if (new Date() < accessToken.exp) {
          return accessToken.token;
        }

        return provider.refreshTokens(req, res, user).then(function(tokens) {
          user.set('externalTokens',
            _(tokens).concat(user.externalTokens).uniq('type').value()
          );

          return formio.resources.submission.model.updateOne({
            _id: userId},
            user,
            {upsert:true})
            .then(() => {
              const token = _.find(tokens, {type: provider.name});
              if (!token) {
                throw `No access token available. Make sure you have authenticated with ${provider.title}.`;
              }
              return token.token;
            });
        });
      }).then((token) => {
        if (next) {
          /* eslint-disable callback-return */
          next(null, token);
          /* eslint-enable callback-return */
        }
        return token;
      }).catch((err) => {
        if (next) {
          return next(err);
        }
      });
    }
  };
};
