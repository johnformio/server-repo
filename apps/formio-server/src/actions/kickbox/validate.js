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
    var msgEnd = 'Please provide a different email address.';
    if (response.body && response.body.result) {
      if (response.body.result === 'undeliverable') {
        switch (response.body.reason) {
          case 'rejected_email':
            return res.status(400).send(email + ' was rejected. ' + msgEnd);
          case 'invalid_domain':
            return res.status(400).send(email + ' is not a valid domain. ' + msgEnd);
          case 'invalid_smtp':
            return res.status(400).send(email + ' is not a valid mail server. ' + msgEnd);
          default:
            return res.status(400).send(email + ' was rejected. ' + msgEnd);
        }
      }
      else if ((response.body.result === 'risky') && response.body.disposable) {
        return res.status(400).send(email + ' is an invalid email address. ' + msgEnd);
      }
    }

    return next();
  });
};
