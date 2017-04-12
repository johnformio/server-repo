'use strict';

var Resource = require('resourcejs');
//var debug = require('debug')('formio:resources:version');

module.exports = function(router, formioServer) {
  var formio = formioServer.formio;

  var hiddenFields = ['deleted', '__v'];
  var resource = Resource(
    router,
    '/project/:projectId',
    'version',
    formio.mongoose.model('version', formio.schemas.version)
  ).rest({
    before: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true})
    ],
    after: [
      formio.middleware.filterResourcejsResponse(hiddenFields)
    ]
  });

  return resource;
};
