'use strict';

module.exports = function(router) {
  return {
    dropbox: require('./dropbox').middleware(router),
    s3: require('./s3').middleware(router),
    azure: require('./azure').middleware(router)
  };
};
