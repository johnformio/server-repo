'use strict';

var _ = require('lodash');

/**
 * Provides URL alias capabilities.
 *
 * Middleware to resolve a form alias into its components.
 */
module.exports = function(formio) {
  var cache = require('../cache/cache')(formio);

  // Handle the request.
  return function(req, res, next) {
    // Get the API Token
    var token = req.headers.hasOwnProperty('x-token') ? req.headers['x-token'] : false;

    // Load the current project.
    cache.loadCurrentProject(req, function(err, currentProject) {
      if (err || !currentProject) {
        return next();
      }

      // Skip the middleware if there are no apiKeys within the project.
      if (
        !currentProject ||
        !currentProject.settings ||
        !currentProject.settings.keys ||
        (currentProject.settings.keys.length === 0) ||
        !token ||
        (token.length < 20) ||
        !_.find(currentProject.settings.keys, {key: token})
      ) {
        return next();
      }

      // Load the formio project.
      cache.loadProjectByName(req, 'formio', function(err, formioProject) {
        if (err || !formioProject) {
          return next();
        }

        // Load the user object.
        var query = {
          name: 'user',
          project: formioProject._id,
          deleted: {$eq: null}
        };

        // Load the user form.
        formio.resources.form.model.findOne(query).exec(function(err, userResource) {
          if (err || !userResource) {
            return next();
          }

          // Load the owner as the current user.
          formio.cache.loadSubmission(req, userResource._id, currentProject.owner, function(err, user) {
            if (err || !user) {
              return next();
            }

            // Set the user and user token.
            req.user = user;
            req.token = {
              user: {
                _id: user._id.toString()
              },
              form: {
                _id: userResource._id.toString(),
                project: formioProject._id.toString()
              }
            };

            // Refresh the token that is sent back to the user when appropriate.
            res.token = formio.auth.getToken(req.token);

            // Set the headers if they haven't been sent yet.
            if (!res.headersSent) {
              res.setHeader('Access-Control-Expose-Headers', 'x-jwt-token');
              res.setHeader('x-jwt-token', res.token);
            }

            // Move onto the next middleware.
            return next();
          });
        });
      });
    });
  };
};
