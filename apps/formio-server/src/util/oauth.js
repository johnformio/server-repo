'use strict';

const Q = require('q');
const _ = require('lodash');

module.exports = function(formio) {
  return {
    // Gets available providers
    // Returns a promise, or you can provide the next callback arg
    // Resolves with array of {name, title}
    availableProviders(req, next) {
      return Q.ninvoke(formio.hook, 'settings', req)
      .then(function(settings) {
        return _(formio.oauth.providers)
        .filter(function(provider, name) {
          // Use custom isAvailable method if available
          return provider.isAvailable && provider.isAvailable(settings) ||
          // Else just check for default client id and secret
            settings.oauth && settings.oauth[name] &&
            settings.oauth[name].clientId &&
            (settings.oauth[name].clientSecret || _.get(settings.oauth[name], 'authorizationMethod') === 'pkce');
        })
        .map(_.partialRight(_.pick, 'name', 'title'))
        .value();
      })
      .nodeify(next);
    },

    // Gets settings for given oauth provider name
    // Returns a promise, or you can provide the next callback arg
    settings(req, name, next) {
      return Q.ninvoke(formio.hook, 'settings', req)
      .then(_.property(`oauth.${name}`))
      .nodeify(next);
    }
  };
};
