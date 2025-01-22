'use strict';
const fetch = require('@formio/node-fetch-http-proxy');

class Service {
  constructor(url) {
    this.url = url;
  }
  start(data) {
    return new Promise((resolve, reject) => {
      fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        rejectUnauthorized: false,
        body: JSON.stringify(data),
      })
        .then((response) => response.ok ? response.json() : null)
        .then((body) => {
          if (!body) {
            return reject('Invalid response from worker url.');
          }
          resolve(body);
        });
    });
  }
}

module.exports = app => (type) => {
  switch (type) {
    case 'nunjucks':
      if (app.formio.config.templateService) {
        return new Service(app.formio.config.templateService);
      }
      break;
  }
  return type;
};
