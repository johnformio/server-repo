'use strict';

module.exports = app => (req, res, next) => {
  if (!req.query.token) {
    return next();
  }

  let aliasToken = req.query.token;
  delete req.query.token;

  // Get the jwt token for this user.
  let redis = app.formio.analytics.getRedis();
  if (!redis) {
    return next('Redis not available');
  }

  redis.get(aliasToken, function(err, token) {
    if (err) {
      return next('Token not valid.');
    }

    if (!token) {
      return next('Token expired.');
    }

    req.headers['x-jwt-token'] = token;
    next();
  });
};
