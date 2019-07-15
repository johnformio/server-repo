'use strict';

const Resource = require('resourcejs');
const _ = require('lodash');
const debug = require('debug')('formio:resources:tag');

module.exports = function(router, formioServer) {
  const formio = formioServer.formio;
  const hook = require('formio/src/util/hook')(formio);

  const hiddenFields = ['deleted', '__v'];
  formio.middleware.restrictOwnerAccess = require('../middleware/restrictOwnerAccess')(formio);

  const resource = Resource(
    router,
    '/project/:projectId',
    'action',
    formio.mongoose.model('actionItem')
  )
    .get({
      beforeGet: [
        formio.middleware.restrictOwnerAccess,
        formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
        (req, res, next) => {
          if (req.method === 'GET') {
            req.modelQuery = req.modelQuery || req.model || this.model;
            req.modelQuery = req.modelQuery.find({project: req.currentProject._id});

            req.countQuery = req.countQuery || req.model || this.model;
            req.countQuery = req.countQuery.find({project: req.primaryProject._id});
          }
          return next();
        }
      ],
      afterGet: [
        formio.middleware.filterResourcejsResponse(hiddenFields)
      ]
    })
    .index({
      beforeIndex: [
        formio.middleware.restrictOwnerAccess,
        formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
        (req, res, next) => {
          if (req.method === 'GET') {
            req.modelQuery = req.modelQuery || req.model || this.model;
            req.modelQuery = req.modelQuery.find({project: req.projectId});

            req.countQuery = req.countQuery || req.model || this.model;
            req.countQuery = req.countQuery.find({project: req.projectId});
          }
          return next();
        }
      ],
      afterIndex: [
        formio.middleware.filterResourcejsResponse(hiddenFields),
      ],
    });

  return resource;
};
