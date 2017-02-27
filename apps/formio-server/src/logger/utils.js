'use strict';

let _ = require('lodash');

module.exports = {
  message: (err, req) => {
    return {
      message: _.get(err, 'message', ''),
      name: _.get(err, 'name', ''),
      stack: _.get(err, 'stack', ''),
      method: _.get(req, 'method', ''),
      params: _.get(req, 'params', ''),
      body: _.get(req, 'body', '')
    };
  }
};
