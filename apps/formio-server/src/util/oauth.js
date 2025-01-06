'use strict';

const _ = require('lodash');

module.exports = function(formio) {
  return {
    // Gets available providers
    // Returns a promise, or you can provide the next callback arg
    // Resolves with array of {name, title}
    async availableProviders(req) {
      try {
        const settings = await formio.hook.settings(req);
        const providers = _(formio.oauth.providers)
          .filter((provider, name) => {
            // Use custom isAvailable method if available
            return (provider.isAvailable && provider.isAvailable(settings)) ||
              // Else just check for default client id and secret
              (settings.oauth && settings.oauth[name] &&
                settings.oauth[name].clientId &&
                (settings.oauth[name].clientSecret || _.get(settings.oauth[name], 'authorizationMethod') === 'pkce'));
          })
          .map(_.partialRight(_.pick, 'name', 'title'))
          .value();
        return providers;
      }
      catch (err) {
        return console.warn('Unable to get available providers.');
      }
    },

    // Gets settings for given oauth provider name
    // Returns a promise, or you can provide the next callback arg
    async settings(req, name) {
      const result = await formio.hook.settings(req);
      const value = _.property(`oauth.${name}`)(result);
      return value;
    }
  };
};
