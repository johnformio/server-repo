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
      ],
      afterGet: [
        formio.middleware.filterResourcejsResponse(hiddenFields)
      ]
    })
    .index({
      beforeIndex: [
        formio.middleware.restrictOwnerAccess,
        formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
      ],
      afterIndex: [
        formio.middleware.filterResourcejsResponse(hiddenFields),
      ],
    });

  return resource;
};
