'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:logger:console');

module.exports = (config, utils) => {
  if (!_.get(config, 'logging.console')) {
    debug('Disabled');
    return false;
  }

  return (err, req) => Promise.resolve()
  .then(() => {
    const message = utils.message(err, req);
    message.date = new Date();

    /* eslint-disable no-console */
    console.error(message);
    /* eslint-enable no-console */
    return message;
  });
};
