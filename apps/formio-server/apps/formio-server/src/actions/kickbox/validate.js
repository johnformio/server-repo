'use strict';

const fetch = require('@formio/node-fetch-http-proxy');
const _ = require('lodash');
const {escapeHtml} = require('../../util/util');

module.exports = function(project, component, path, req, res, next) {
  if (!_.has(req.body, `data.${path}`)) {
    return next();
  }

  // Ensure this is an email component.
  if (component.type !== 'email') {
    return next();
  }

  // Only continue if they have kickbox creds.
  if (!project.settings.kickbox || !project.settings.kickbox.apikey) {
    return next();
  }

  // Get the email address from the component.
  const email = _.get(req.body, `data.${path}`) || '';
  if (!email) {
    return res.status(400).send(`Invalid email address provided to ${component.key}.`);
  }

  // Verify the email with kickbox.
  fetch(`https://api.kickbox.com/v2/verify?email=${email}&apikey=${project.settings.kickbox.apikey}`)
  .then(response => response.json()).then(data => {
    const msgEnd = 'Please provide a different email address.';
    if (data && data.result) {
      res.setHeader('Content-Type', 'text/plain');
      if (data.result === 'undeliverable') {
        switch (data.reason) {
          case 'rejected_email':
            return res.status(400).send(`${escapeHtml(email)} was rejected. ${msgEnd}`);
          case 'invalid_domain':
            return res.status(400).send(`${escapeHtml(email)} is not a valid domain. ${msgEnd}`);
          case 'invalid_smtp':
            return res.status(400).send(`${escapeHtml(email)} is not a valid mail server. ${msgEnd}`);
          default:
            return res.status(400).send(`${escapeHtml(email)} was rejected. ${msgEnd}`);
        }
      }
      else if ((data.result === 'risky') && data.disposable) {
        return res.status(400).send(`${escapeHtml(email)} is an invalid email address. ${msgEnd}`);
      }
    }
    return next();
  })
  .catch(err => {
    return res.status(400).json(`Kickbox.io - ${err.message}`);
  });
};
