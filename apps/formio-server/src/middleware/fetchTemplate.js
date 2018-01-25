'use strict';
const request = require('request');
const isURL = require('is-url');
const debug = require('debug')('formio:middleware:projectTemplate');
module.exports = (req, res, next) => {
  if (!req.body || !req.body.template) {
    return next();
  }

  // Template is already an object, just move on.
  if (typeof req.body.template === 'object') {
    return next();
  }

  if (typeof req.body.template !== 'string') {
    return next('Unknown project template format.');
  }

  if (!isURL(req.body.template)) {
    req.body.template = JSON.parse(req.body.template);
    return next();
  }

  return request({
    url: req.body.template,
    json: true
  }, function(err, response, body) {
    if (err) {
      debug(err);
      return next(err.message || err);
    }

    if (!response) {
      return next('Invalid project template.');
    }

    if (response.statusCode !== 200) {
      return res.status(400).send('Unable to load template.');
    }

    // Import the template.
    req.body.template = body;
    return next();
  });
};
