'use strict';

const _ = require('lodash');
const rest = require('restler');
const debug = require('debug')('formio:logger:formio');

module.exports = (config, utils) => {
  if (!_.get(config, 'logging.formio')) {
    debug('Disabled');
    return false;
  }

  return (err, req) => new Promise((resolve, reject) => {
    const url = _.get(config, 'logging.formio');
    debug(url);

    const data = {data: utils.message(err, req)};
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
