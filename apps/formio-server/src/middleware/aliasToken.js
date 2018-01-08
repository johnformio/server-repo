'use strict';

module.exports = app => (req, res, next) => {
  if (!req.query.token) {
    return next();
  }

  const aliasToken = req.query.token;
  delete req.query.token;

  // Get the jwt token for this user.
  app.formio.redis.getDb((err, db) => {
    if (err) {
      return next(err.message);
    }

    if (!db) {
      // No db is found, so just continue...
      return next();
    }

    db.get(aliasToken, function(err, token) {
      if (err) {
        return next('Token not valid.');
      }

      if (!token) {
        return next('Token expired.');
      }

      req.headers['x-jwt-token'] = token;
      next();
    });
  });
};
