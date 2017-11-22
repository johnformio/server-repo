'use strict';

module.exports = function(router, formioServer) {
  return {
    project: require('./ProjectResource')(router, formioServer),
    tag: require('./TagResource')(router, formioServer),
    formrevision: require('./FormRevisionResource')(router, formioServer)
  };
};
