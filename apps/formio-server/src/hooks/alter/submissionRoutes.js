'use strict';

const _ = require('lodash');

module.exports = app => routes => {
  const licenseUtilizationMiddleware = require('../../middleware/licenseUtilization').middleware(app.formio.formio);

  const filterExternalTokens = app.formio.formio.middleware.filterResourcejsResponse(['externalTokens']);
  const conditionalFilter = function(req, res, next) {
    if (req.token && res.resource && res.resource.item && res.resource.item._id) {
      // Only allow tokens for the actual user.
      if (req.token.user._id !== res.resource.item._id.toString()) {
        return filterExternalTokens(req, res, next);
      }

      // Whitelist which tokens can be seen on the frontend.
      const allowedTokens = ['dropbox'];
      res.resource.item.externalTokens = _.filter(res.resource.item.externalTokens, function(token) {
        return _.indexOf(allowedTokens, token.type) > -1;
      });

      return next();
    }
    else {
      return filterExternalTokens(req, res, next);
    }
  };

  _.each(['afterGet', 'afterIndex', 'afterPost', 'afterPut', 'afterDelete'], function(handler) {
    routes[handler].push(conditionalFilter);
  });

  // Add a submission model set before the index.
  routes.beforeIndex.unshift((req, res, next) => app.formio.formio.cache.setSubmissionModel(
    req,
    app.formio.formio.cache.getCurrentFormId(req),
    next
  ));

  // Add the form version id to each submission.
  _.each(['beforePost', 'beforePut'], (handler) => {
    if (handler === 'beforePost') {
      routes[handler].unshift((req, res, next) => app.formio.formio.cache.setSubmissionModel(
        req,
        app.formio.formio.cache.getCurrentFormId(req),
        next
      ));
    }

    routes[handler].push((req, res, next) => {
      if (typeof req.body === 'object') {
        // Always set the project ID to the current project.
        req.body.project = req.projectId || req.params.projectId;

        if (!req.body.hasOwnProperty('_fvid') || isNaN(parseInt(req.body._fvid))) {
          req.body._fvid = req.currentForm._vid || 0;
        }
      }
      next();
    });

    // Skip validation if state is draft.
    // Eventually this will be configurable but hard code to draft == noValidate for now.
    routes[handler].unshift((req, res, next) => {
      if (_.get(req, 'body.state', 'submitted') === 'draft') {
        req.noValidate = true;
      }
      next();
    });
  });

  // Add license utilization middleware
  _.each(['beforePost', 'beforePut', 'beforeIndex', 'beforeGet'], handler => {
    routes[handler].unshift(licenseUtilizationMiddleware);
  });

  return routes;
};
