'use strict';

/**
 * The requestCount middleware.
 *
 * This middleware is used for counting finished responses.
 *
 * @param requestCache {RequestCache}
 * @returns {Function}
 */
module.exports = function(requestCache) {
  return function(req, res, next) {
    const namespaces = requestCache.getNamespaces();
    req.requestCount = req.requestCount || {};

    namespaces.forEach((ns) => {
      req.requestCount[ns] = requestCache.getRequestsData(ns);
    });

    return next();
  };
};
