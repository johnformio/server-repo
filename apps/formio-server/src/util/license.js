'use strict';

const request = require('request-promise-native');
const crypto = require('crypto');
const os = require('os');
const jwt = require('jsonwebtoken');

/* eslint-disable no-console */
module.exports = (app, config) => {
  if (!config.license) {
    console.error('License error: No license detected. Please set in LICENSE environment variable.');
    process.exit(1);
  }

  const timestamp = Date.now();

  const payload = jwt.decode(config.license);
  if (!payload) {
    console.error('License error: Could not read license.');
    process.exit(1);
  }

  payload.timestamp = timestamp;
  const hash = crypto.createHash('md5').update(Buffer.from(JSON.stringify(payload)).toString('base64')).digest('hex');

  request({
    method: 'POST',
    url: 'https://license.form.io/validate',
    headers: {
      'content-type': 'application/json'
    },
    json: {
      timestamp,
      token: config.license,
      mongoHash: crypto.createHash('md5').update(config.formio.mongo).digest('hex'),
      hostname: os.hostname()
    }
  })
    .then(result => {
      if (result !== hash) {
        console.error('License error: Invalid license');
        process.exit(1);
      }
      console.log(' > License validated.');
    })
    .catch(err => {
      console.error(`License error: ${err.message}`);
      process.exit(1);
    });
};
