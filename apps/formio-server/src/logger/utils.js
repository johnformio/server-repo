'use strict';

module.exports = {
  message: (err, req) => {
    return {
      message: err.message || err,
      name: err.name || '',
      stack: err.stack || '',
      method: req.method || '',
      params: req.params || {},
      body: req.body || {},
      url: req.url || '',
      user: req.user ? req.user._id.toString() : ''
    };
  }
};
