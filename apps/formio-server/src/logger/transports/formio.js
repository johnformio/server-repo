'use strict';

let _ = require('lodash');
let rest = require('restler');
let debug = require('debug')('formio:logger:formio');

module.exports = (config, utils) => {
  if (!_.get(config, 'logging.formio')) {
    debug('Disabled');
    return false;
  }
  
  return (err, req) => new Promise((resolve, reject) => {
    let url = _.get(config, 'logging.formio');
    debug(url);

    let data = {data: utils.message(err, req)};
    debug(data);

    rest.postJson(url, data).on('complete', function(result) {
      if (result instanceof Error) {
        return reject(result);
      }

      debug(result);
      return resolve(result);
    });
  });
};
