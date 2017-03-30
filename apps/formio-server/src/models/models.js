'use strict';

module.exports = function(router) {
  return {
    project: require('./Project')(router),
    version: require('./Version')(router)
  };
};
