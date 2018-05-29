'use strict';

const _ = require('lodash');

module.exports = (config, utils) => {
  if (!_.get(config, 'logging.console')) {
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
