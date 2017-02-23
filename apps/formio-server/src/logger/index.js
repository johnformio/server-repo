'use strict';

let _ = require('lodash');
let debug = require('debug')('formio:logger');

module.exports = (config) => {
  let ConsoleLogger = require('./transports/console')(config);
  let FormioLogger = require('./transports/formio')(config);

  /**
   * Middleware to catch any generic error originating in an express route.
   *
   * @param err
   * @param req
   * @param res
   */
  let middleware = (err, req, res) => {
    console.log(`in the error handler..`);
    
    // Build the handlers list, and invoke each with the err and req.
    let handlers = _([
      ConsoleLogger,
      FormioLogger
    ])
    .filter()
    .map((h) => {
      return h(err, req)
    })
    .values();

    return Promise.all(handlers)
    .then((r) => {
      return res.sendStatus(500);
    })
    .catch(fatal => {
      console.error(`Fatal Logger Error: ${fatal}`);
      return res.sendStatus(500);
    });
  };

  return {middleware};
};
