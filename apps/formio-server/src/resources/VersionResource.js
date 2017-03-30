'use strict';

var Resource = require('resourcejs');
var debug = require('debug')('formio:resources:version');

module.exports = function(router, formioServer) {
  var formio = formioServer.formio;

  var hiddenFields = ['deleted', '__v'];
  var resource = Resource(
    router,
    '',
    'version',
    formio.mongoose.model('version', formio.schemas.version)
  ).rest({
    beforeGet: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
    ],
    afterGet: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
    ],
    beforePost: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
    ],
    afterPost: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
    ],
    beforeIndex: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
    ],
    afterIndex: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
    ],
    beforePut: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
    ],
    afterPut: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
    ],
    beforeDelete: [
      formio.middleware.filterMongooseExists({field: 'deleted', isNull: true}),
    ],
    afterDelete: [
      formio.middleware.filterResourcejsResponse(hiddenFields),
    ]
  });

  return resource;
};
