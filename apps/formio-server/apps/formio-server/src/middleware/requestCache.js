'use strict';

const debug = require('debug')('formio:requestCache');

/**
 * The healthCache middleware.
 *
 * This middleware is used for caching response after finish.
 *
 * @param requestCache {RequestCache}
 * @returns {Function}
 */
module.exports = function(requestCache) {
  const namespaces = [
    {ns: '1min', ttl: 60},
    {ns: '5min', ttl: 300},
    {ns: '15min', ttl: 900},
  ];

  return function(req, res, next) {
    res.on('finish', () => {
      try {
        if (!res.statusCode || !req.method) {
          return;
        }

        namespaces.forEach(({ns, ttl}) => {
          requestCache.addRequest(ns, req.uuid, {method: req.method, code: res.statusCode}, ttl);
        });
      }
      catch (err) {
        debug(err.message || err);
      }
    });

    next();
  };
};
