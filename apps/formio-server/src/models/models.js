'use strict';

module.exports = function(router, models) {
  return {
    project: require('./Project')(router),
    formrevision: require('./FormRevision')(router, models),
    submissionrevision: require('./SubmissionRevision')(router, models),
    session: require('./Session')(router),
    tag: require('./Tag')(router)
  };
};
