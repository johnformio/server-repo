'use strict';
var kickbox = require('kickbox');
module.exports = function(project, component, req, res, next) {
  if (!req.body || !req.body.data || !req.body.data[component.key]) {
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
  var email = req.body.data && req.body.data.hasOwnProperty(component.key) ? req.body.data[component.key] : '';
  if (!email) {
    return res.status(400).send('Invalid email address provided to ' + component.key + '.');
  }

  // Verify the email with kickbox.
  var verification = kickbox.client(project.settings.kickbox.apikey).kickbox();
  verification.verify(email, function(err, response) {
    if (err) {
      return res.status(400).json(err.message);
    }
    if (response.body && response.body.result) {
      switch (response.body.result) {
        case 'undeliverable':
          switch (response.body.reason) {
            case 'rejected_email':
              return res.status(400).send(email + ' was rejected. Please provide a different email address.');
              break;
            case 'invalid_domain':
              return res.status(400).send(email + ' is not a valid domain. Please provide a different email address.');
              break;
            case 'invalid_smtp':
              return res.status(400).send(email + ' is not a valid mail server. Please provide a different email address.');
              break;
            default:
              return res.status(400).send(email + ' was rejected. Please provide a different email address.');
              break;
          }
          break;
        case 'risky':
          if (response.body.disposable) {
            return res.status(400).send(email + ' is an invalid email address. Please provide a different email address.');
          }
          else {
            next();
          }
          break;
        default:
          // We good...
          next();
          break;
      }
    }
    else {
      // We good.
      next();
    }
  });
};
