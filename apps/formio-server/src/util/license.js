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

  const schema = app.formio.formio.mongoose.models.schema;

  const getDbIdentifier = function() {
    return new Promise((resolve, reject) => {
      schema.findOne({key: 'dbIdentifier'}, (err, info) => {
        if (err) {
          return reject(err);
        }
        else if (info) {
          return resolve(info.value);
        }
        else {
          const id = app.formio.formio.mongoose.Types.ObjectId();
          schema.create({
            key: 'dbIdentifier',
            value: id
          });
          resolve(id.toString());
        }
      });
    });
  };

  getDbIdentifier()
    .then(dbIdentifier => {
      const timestamp = Date.now() - 6000;

      const payload = jwt.decode(config.license);
      if (!payload) {
        console.error('License error: Could not read license.');
        process.exit(1);
      }

      payload.timestamp = timestamp;
      const hash = crypto.createHash('md5').update(
        Buffer.from(JSON.stringify(payload)).toString('base64')
      ).digest('hex');

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
          hostname: os.hostname(),
          dbIdentifier,
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
          console.error('License error:', err);
          process.exit(1);
        });
    })
    .catch(err => {
      console.error('License error:', err);
      process.exit(1);
    });
};
