'use strict';

const fs = require('fs');
const request = require('request');

const server = process.env.SERVER || 'http://localhost:3000';
const accessKey = process.env.ACCESS_KEY;

fs.readFile('./project.json', 'utf8', function(err, data) {
  const template = JSON.parse(data);

  request({
    method: 'POST',
    uri: server + '/project',
    headers: {
      'Content-Type': 'application/json',
      'access-key': accessKey
    },
    json: {
      template: template,
      title: template.title,
      name: template.name
    }
  }, function(err, response, body) {
    /* eslint-disable no-console */
    if (err) {
      console.log(err);
    }
    else {
      console.log(response.statusCode, response.statusMessage);
    }
  });
});
