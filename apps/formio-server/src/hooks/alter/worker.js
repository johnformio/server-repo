'use strict';
const request = require('request');

class Service {
  constructor(url) {
    this.url = url;
  }
  start(data) {
    return new Promise((resolve, reject) => {
      request({
        url: this.url,
        method: 'POST',
        body: data,
        json: true
      }, function(error, response, body) {
          if (!response) {
            return reject('Invalid response.');
          }

          if (response.statusCode === 200) {
            resolve(body);
          }
          else {
            reject(error);
          }
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
