'use strict';

let _ = require('lodash');
let rest = require('restler');
let debug = require('debug')('formio:logger:formio');

module.exports = (config) => {
  if (!_.get(config, 'logging.formio')) {
    debug('Disabled');
    return false;
  }
  
  return (err, req) => new Promise((resolve, reject) => {
    let url = _.get(config, 'logging.formio');
    debug(url);

    rest.postJson(`${url}/submission`, {
      data: {
        message: _.get(err, 'message', ''),
        name: _.get(err, 'name', ''),
        fileName: _.get(err, 'fileName', ''),
        lineNumber: _.get(err, 'lineNumber', ''),
        columnNumber: _.get(err, 'columnNumber', ''),
        stack: _.get(err, 'stack', '')
      }
    }).on('complete', function(result) {
      if (result instanceof Error) {
        return reject(result);
      }

      debug(result);
      return resolve(result);
    });
  });
};
