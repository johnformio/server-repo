var _ = require('lodash');
module.exports = {
  tokenRegex: new RegExp(/\[\[\s*token\(\s*([^\)]+\s*)\)\s*,?\s*([0-9]*)\s*\]\]/i),
  ssoToken: function(text) {
    var matches = text.match(this.tokenRegex);
    if (matches && matches.length > 1) {
      var parts = matches[1].split('=');
      var field = _.trim(parts[0]);
      var resources = _.map(parts[1].split(','), _.trim);
      var expireTime = parseInt(_.trim(matches[2]), 10);
      if (!expireTime || isNaN(expireTime)) {
        expireTime = 120;
      }
      if (!resources || !resources.length) {
        return null;
      }
      if (!field) {
        return null;
      }

      // Return the sso token information.
      return {
        resources: resources,
        expireTime: expireTime,
        field: field
      };
    }
    return null;
  }
};
