'use strict';

const Resource = require('resourcejs');

module.exports = function(router, formioServer) {
  const formio = formioServer.formio;

  const options = {
    before: [
      (req, res, next) => {
        // Disable Patch for forms for now.
        if (req.method === 'PATCH') {
          return res.sendStatus(405);
        }
        return next();
      },
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.bootstrapEntityOwner,
      (req, res, next) => {
        if (req.params['vId'] && req.params['vId'].length === 24) {
          return next();
        }
        else {
          return formio.middleware.formHandler(req, res, next);
        }
      },
      formio.middleware.formActionHandler('before'),
      (req, res, next) => {
        // Always add the resourceId to all queries.
          req.query['_rid'] =  req.params['formId'];
        next();
      }
    ],
    after: [
      formio.middleware.bootstrapFormAccess,
      formio.middleware.formLoader,
      formio.middleware.formActionHandler('after'),
      formio.middleware.filterResourcejsResponse(['deleted', '__v'])
    ],
    hooks: {
      get: {
        before: (req, res, search, next) => {
          if (req.params['vId'] && req.params['vId'].length === 24) {
            search.revisionId = req.params['vId'];
            delete search['_id'];
            return next();
          }
          else {
          search['_rid'] = req.params['formId'];
          // Add vid if set.
          if (req.params['vId']) {
            delete search['_id'];
            search['_vid'] = !isNaN(req.params['vId']) ? parseInt(req.params['vId']) : req.params['vId'];
            if (req.params['vId'] === 'latest') {
              delete search['_vid'];
              req.modelQuery.sort('-_vid').limit(1);
            }
          }
          return next();
          }
        }
      }
    }
  };

  // We only want index and get endpoints for formrevisions. They are currently uneditable.
  return Resource(
    router,
    '/project/:projectId/form/:formId',
    'v',
    formio.mongoose.model('formrevision')
  )
    .index(options)
    .get(options);
};
