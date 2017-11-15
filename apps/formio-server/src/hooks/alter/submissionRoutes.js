'use strict';

const _ = require('lodash');

module.exports = app => routes => {
  var filterExternalTokens = app.formio.formio.middleware.filterResourcejsResponse(['externalTokens']);
  var conditionalFilter = function(req, res, next) {
    if (req.token && res.resource && res.resource.item && res.resource.item._id) {
      // Only allow tokens for the actual user.
      if (req.token.user._id !== res.resource.item._id.toString()) {
        return filterExternalTokens(req, res, next);
      }

      // Whitelist which tokens can be seen on the frontend.
      var allowedTokens = ['dropbox'];
      res.resource.item.externalTokens = _.filter(res.resource.item.externalTokens, function(token) {
        return _.indexOf(allowedTokens, token.type) > -1;
      });

      return next();
    }
    else {
      return filterExternalTokens(req, res, next);
    }
  };

  _.each(['afterGet', 'afterIndex', 'afterPost', 'afterPut', 'afterDelete'], function(handler) {
    routes[handler].push(conditionalFilter);
  });

  // Add the form version id to each submission.
  _.each(['beforePost', 'beforePut'], function(handler) {
    routes[handler].push(function(req, res, next) {
      req.body._fvid = req.currentForm._vid || 0;
      next();
    });
  });

  return routes;
};
