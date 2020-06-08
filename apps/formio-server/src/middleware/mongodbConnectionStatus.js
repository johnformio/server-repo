'use strict';

/**
 * The mongodbConnectionState middleware.
 *
 * This middleware is used for checking mongodb connection state.
 *
 * @param formio
 * @returns {Function}
 */
module.exports = (formio) => function(req, res, next) {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  if (!formio.mongoose || !formio.mongoose.connection) {
    req.mongodbConnectionStatus = 'connection doesn\'t exist';
    return next();
  }

  const mongodbState = formio.mongoose.connection.readyState;
  req.mongodbConnectionStatus = states[mongodbState] || 'unresolved';
  return next();
};
