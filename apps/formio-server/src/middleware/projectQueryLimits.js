'use strict';

const _set = require('lodash/set');
const _get = require('lodash/get');

/**
 * Middleware to increase a limit for loading all projects per request.
 *
 * @returns {Function}
 */
module.exports = function(req, res, next) {
  if (req.path === '/project' && req.method === 'GET') {
    const limit = _get(req, 'query.limit', false);

    if (!limit || Number(limit) < 10000) {
      req.originalLimit = limit;
      _set(req, 'query.limit', '10000');
    }
  }
  next();
};
