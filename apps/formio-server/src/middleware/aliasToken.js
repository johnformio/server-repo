'use strict';

module.exports = app => (req, res, next) => {
  if (!req.query.token) {
    return next();
  }

  let aliasToken = req.query.token;
  delete req.query.token;

  // Get the jwt token for this user.
  app.formio.redis.getDb((err, db) => {
    if (err) {
      return next(err.message);
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
