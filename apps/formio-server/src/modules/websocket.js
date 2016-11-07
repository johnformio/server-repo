'use strict';

var _ = require('lodash');

module.exports = function(app, config) {
  var formio = app.formio.formio;
  var ProjectSocket = require('./websocket/ProjectSocket')(formio);

  // Create a project socket.
  var socket = new ProjectSocket(app.server, config);

  // Register all traffic coming through submissions.
  app.use('/project/:projectId/form/:formId/submission', function(req, res, next) {
    // Create the socket request.
    var request = _.pick(req, [
      'method',
      'body',
      'url',
      'params',
      'query'
    ]);

    formio.plans.getPlan(req, function(err, plan) {
      if (err) {
        return next(err);
      }
      if (['team', 'commercial'].indexOf(plan) === -1) {
        return res.status(402).send('A Team or Commercial plan is required to use Websockets.');
      }

      // Send the request to the socket.
      socket.send(request).then(function(data) {
        if (data && data.response) {
          if (data.response.status && (data.response.status !== 200)) {
            res.status(data.response.status).json(data.response.message);
            return;
          }
          if (data.response.body) {
            _.assign(req.body, data.response.body);
          }
        }
        next();
      }).catch(next);
    });
  });
};
