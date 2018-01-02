'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:logger');

module.exports = (config) => {
  const utils = require('./utils');
  const ConsoleLogger = require('./transports/console')(config, utils);
  const FormioLogger = require('./transports/formio')(config, utils);

  /**
   * Middleware to catch any generic error originating in an express route.
   *
   * NOTE: This middleware must keep the next param in the signature, or express won't load it..
   *
   * @param err
   * @param req
   * @param res
   * @param next
   * @returns {Promise.<TResult>}
   */
  const middleware = (err, req, res, next) => {
    // Build the handlers list, and invoke each with the err and req.
    const handlers = _([
      ConsoleLogger,
      FormioLogger
    ])
    .filter()
    .map((h) => h(err, req))
    .values();

    return Promise.all(handlers)
    .then((results) => {
      debug(results);

      if (res !== undefined) {
        return res.sendStatus(500);
      }
    })
    .catch(fatal => {
      /* eslint-disable no-console */
      console.error(`Fatal Logger Error: ${fatal}`);
      /* eslint-enable no-console */
      try {
        return res.sendStatus(500);
      }
      catch (e) {
        // res is undefined, called from global uncaughtException handler.
      }
    });
  };

  return {middleware};
};
