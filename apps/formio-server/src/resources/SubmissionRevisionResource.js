'use strict';

const Resource = require('resourcejs');

module.exports = function(router, formioServer) {
  const formio = formioServer.formio;

  const options = {
    before: [
      (req, res, next) => {
        if (req.method === 'PATCH') {
          return res.sendStatus(405);
        }
        return next();
      },
      (req, res, next) => {
          req.query['_rid'] =  req.params['submissionId'];
        next();
      },
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true})
    ],
    after: [
      formio.middleware.filterResourcejsResponse(['deleted', '__v'])
    ],
  };

  // We only want index and get endpoints for submission revisions. They are currently uneditable.
  return Resource(
    router,
    '/project/:projectId/form/:formId/submission/:submissionId',
    'v',
    formio.mongoose.model('submissionrevision')
  )
    .index(options)
    .get(options);
};
