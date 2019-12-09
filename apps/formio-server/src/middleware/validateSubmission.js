'use strict';
const {Resource} = require('resourcejs');
const _ = require('lodash');

/**
 * A handler for tag based requests.
 *
 * @param router
 * @returns {Function}
 */
module.exports = function(app) {
  const subRequest = function(req, query, next) {
    const sub = {req: null, res: null};
    sub.req = app.formio.formio.util.createSubRequest(req);
    if (!sub.req) {
      throw new Error('Too many recursive requests.');
    }
    sub.req.noResponse = true;
    sub.req.skipOwnerFilter = false;
    sub.req.url = '/form/:formId/submission';
    sub.req.query = query || {};
    sub.req.method = 'POST';
    sub.res = app.formio.formio.util.createSubResponse();
    app.formio.resourcejs[sub.req.url].post.call(this, sub.req, sub.res, () => {
      sub.req.noResponse = false;
      return next(sub.req, sub.res);
    });
    return sub;
  };

  app.post('/project/:projectId/form/:formId/validate', (req, res, next) => {
    subRequest(req, {dryrun: true}, (subReq, subRes) => Resource.respond(subReq, subRes, _.noop));
  });

  app.post('/project/:projectId/form/:formId/execute', (req, res, next) => {
    next();
  });

  return app;
};
