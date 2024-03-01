'use strict';

const config = require('../../config');
const fetch = require('@formio/node-fetch-http-proxy');

function createXFileToken() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array(30).join().split(',').map(function() {
    return alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }).join('');
}

module.exports = async (req, res, next) => {
  // Only for hosted deployments
  if (!config.formio.hosted) {
    return next();
  }

  // Allows to use local PDF project.
  // To use PDF project you need to create it first
  // And make it possible you need to skip PDF info creating for this project
  if (req.query.skipPdfInfo) {
    return next();
  }

  const headers = {
    'x-token': config.pdfProjectApiKey,
    'Content-Type': 'application/json'
  };
  try {
    await fetch(`${config.pdfProject}/info/submission`, {
      method: 'POST',
      headers,
      rejectUnauthorized: false,
      body: JSON.stringify({
        data: {
          project: res.resource.item._id,
          plan: 'basic',
          forms: '0',
          submissions: '0',
          lastConversion: new Date().getTime(),
          status: 'active',
          token: createXFileToken(),
          host: req.headers['host'],
        },
      }),
    });
  }
  catch (err) {
    return next(err);
  }
  return next();
};
