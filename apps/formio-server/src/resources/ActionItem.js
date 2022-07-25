'use strict';

const Resource = require('resourcejs');

module.exports = function(router, formioServer) {
  const formio = formioServer.formio;

  const hiddenFields = ['deleted', '__v'];
  formio.middleware.restrictProjectAccess = require('../middleware/restrictProjectAccess')(formio);

  const resource = Resource(
    router,
    '/project/:projectId',
    'action',
    formio.mongoose.model('actionItem'),
  )
    .get({
      beforeGet: [
        formio.middleware.restrictProjectAccess({level: 'admin'}),
        formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
        (req, res, next) => {
          if (req.method === 'GET') {
            req.modelQuery = req.modelQuery || req.model || this.model;
            req.modelQuery = req.modelQuery.find({project: formio.util.idToBson(req.currentProject._id)});

            req.countQuery = req.countQuery || req.model || this.model;
            req.countQuery = req.countQuery.find({project: formio.util.idToBson(req.primaryProject._id)});
          }

          return next();
        },
      ],
      afterGet: [
        formio.middleware.filterResourcejsResponse(hiddenFields),
      ],
    })
    .index({
      beforeIndex: [
        formio.middleware.restrictProjectAccess({level: 'admin'}),
        formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
        (req, res, next) => {
          if (req.method === 'GET') {
            req.modelQuery = req.modelQuery || req.model || this.model;
            req.modelQuery = req.modelQuery.find({project: req.projectId});

            req.countQuery = req.countQuery || req.model || this.model;
            req.countQuery = req.countQuery.find({project: req.projectId});
          }

          return next();
        },
      ],
      afterIndex: [
        formio.middleware.filterResourcejsResponse(hiddenFields),
      ],
    });

  return resource;
};
