'use strict';

module.exports = (app) => async (req, res, next) => {
  if (!req.query.token) {
    return next();
  }

  if (req.url.match('/manage/view')) {
    return next();
  }

  const aliasToken = req.query.token;
  delete req.query.token;

  // Get the jwt token for this user.
  try {
    const token = await app.formio.formio.mongoose.models.token.findOne({
      key: aliasToken,
    });

    if (!token) {
      return next('Token expired.');
    }

    req.headers['x-jwt-token'] = token.value;
    return next();
  }
  catch (err) {
    if (err) {
      return next('Token not valid.');
    }
  }
};
