'use strict';
const fetch = require('@formio/node-fetch-http-proxy');
const isURL = require('is-url');

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

  return fetch(req.body.template, {
    rejectUnauthorized: false
  })
    .catch((err) => next(err.message || err))
    .then((response) => response.ok ? response.json() : null)
    .then((body) => {
      if (!body) {
        return res.status(400).send('Unable to load template.');
      }

      // Import the template.
      req.body.template = body;
      return next();
    });
};
