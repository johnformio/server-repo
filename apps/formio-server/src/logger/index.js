'use strict';

let _ = require('lodash');
let debug = require('debug')('formio:logger');

module.exports = (config) => {
  let utils = require('./utils');
  let ConsoleLogger = require('./transports/console')(config, utils);
  let FormioLogger = require('./transports/formio')(config, utils);

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
  let middleware = (err, req, res, next) => {
    // Build the handlers list, and invoke each with the err and req.
    let handlers = _([
      ConsoleLogger,
      FormioLogger
    ])
    .filter()
    .map((h) => h(err, req))
    .values();

    return Promise.all(handlers)
    .then((results) => {
      debug(results);
      return res.sendStatus(500);
    })
    .catch(fatal => {
      console.error(`Fatal Logger Error: ${fatal}`);
      try {
        return res.sendStatus(500);
      }
      catch (e) {}
    });
  };

  return {middleware};
};
