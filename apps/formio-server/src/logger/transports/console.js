'use strict';

let _ = require('lodash');
let debug = require('debug')('formio:logger:console');

module.exports = (config) => {
  if (!_.get(config, 'logging.console')) {
    debug('Disabled');
    return false;
  }

  return (err, req) => Promise.resolve()
  .then(() => {
    let message = {
      date: new Date(),
      message: _.get(err, 'message', ''),
      name: _.get(err, 'name', ''),
      fileName: _.get(err, 'fileName', ''),
      lineNumber: _.get(err, 'lineNumber', ''),
      columnNumber: _.get(err, 'columnNumber', ''),
      stack: _.get(err, 'stack', '')
    };

    console.error(message);
    return message;
  });
};
