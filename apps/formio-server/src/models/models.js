'use strict';

module.exports = function(router, models) {
  return {
    project: require('./Project')(router),
    formrevision: require('./FormRevision')(router, models),
    tag: require('./Tag')(router)
  };
};
