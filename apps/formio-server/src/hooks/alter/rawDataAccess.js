'use strict';
const {createHmac} = require('node:crypto');

// Allows to retrieve raw DB data object (including protected fields)
// only if API/Admin Key is provided and 'x-raw-data-access' header hash matches the API/Admin Key hash
module.exports = (req, next) => {
  if (!req.headers['x-raw-data-access'] || !req.isAdmin) {
    return false;
  }

  try {
    const authToken = req.headers['x-token'] || req.headers['x-admin-key'];

    if (!authToken) {
      return next('API Key or Admin Key are required for raw data access.');
    }

    if (createHmac('sha256', authToken).digest('hex') !== req.headers['x-raw-data-access']) {
      return next('Invalid raw data access header provided.');
    }

    return true;
  }
  catch (err) {
    return false;
  }
};
