'use strict';

module.exports = function(router) {
  return {
    dropbox: require('./dropbox')(router),
    s3: require('./s3')(router),
    azure: require('./azure')(router)
  };
};
