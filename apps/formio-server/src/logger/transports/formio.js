'use strict';

const _ = require('lodash');
const rest = require('restler');

module.exports = (config, utils) => {
  if (!_.get(config, 'logging.formio')) {
    return false;
  }

  return (err, req) => new Promise((resolve, reject) => {
    const url = _.get(config, 'logging.formio');
    const data = {data: utils.message(err, req)};

    rest.postJson(url, data).on('complete', function(result) {
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
};
