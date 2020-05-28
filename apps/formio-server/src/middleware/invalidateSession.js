'use strict';

const LOG_EVENT = 'Invalidate Session';

module.exports = (app) => {
  const {
    log: logOutput,
  } = app.formio.formio;
  const log = (...args) => logOutput(LOG_EVENT, ...args);

  return (req, res, next) => {
    if (req.method !== 'GET' || !req.token) {
      return next();
    }

    if (!req.token.session) {
      log(req, 'Missing session id in token');
      return next();
    }

    // Get the jwt token for this user.
    app.formio.formio.mongoose.models.session.updateOne(
      {
        _id: req.token.session,
        deleted: {$eq: null},
      },
      {
        deleted: Date.now(),
      },
    )
      .then(() => {
        log(req, 'Session was successfully invalidated');
      })
      .catch((err) => {
        log(req, 'Error occured while invalidating session', err);
      })
      .then(() => next());
  };
};
