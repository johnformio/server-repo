'use strict';

const fs = require('fs');
const request = require('request');

const server = process.env.SERVER || 'http://localhost:3000';
const email = process.env.ADMIN_EMAIL || 'admin@example.com';
const password = process.env.ADMIN_PASSWORD || 'password';
const adminKey = process.env.ADMIN_KEY;

fs.readFile('./formio.json', 'utf8', function(err, data) {
  const template = JSON.parse(data);

  request({
    method: 'POST',
    uri: `${server}/project`,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey
    },
    json: {
      template: template,
      title: template.title,
      name: template.name,
      plan: 'commercial'
    }
  }, function(err, response, project) {
    /* eslint-disable no-console */
    if (err) {
      console.log(err);
      process.exit(1);
    }
    else {
      console.log('project', response.statusCode, response.statusMessage, project._id);
      request({
        method: 'POST',
        uri: `${server}/project/${project._id}/user`,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        json: {
          data: {
            name: 'admin',
            email,
            password
          }
        }
      }, function(err, response, user) {
        if (err) {
          console.log(err);
          process.exit(1);
        }
        console.log('user', response.statusCode, response.statusMessage, user._id);
        request({
          method: 'POST',
          uri: `${server}/project/${project._id}/owner`,
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminKey
          },
          json: {
            owner: user._id
          }
        }, function(err, response, project) {
          if (err) {
            console.log(err);
            process.exit(1);
          }
          console.log('set owner', response.statusCode, response.statusMessage);
        });
      });
    }
  });
});
