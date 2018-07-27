'use strict';

const Resource = require('resourcejs');

module.exports = function(router, formioServer) {
  const formio = formioServer.formio;

  const options = {
    before: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      formio.middleware.bootstrapEntityOwner,
      formio.middleware.formHandler,
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
          search['_rid'] = req.params['formId'];
          // Add vid if set.
          if (req.params['vId']) {
            delete search['_id'];
            search['_vid'] = !isNaN(req.params['vId']) ? parseInt(req.params['vId']) : req.params['vId'];
          }
          next();
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
