'use strict';

module.exports = function(router, formioServer) {
  return {
    actionItem: require('./ActionItem')(router, formioServer),
    project: require('./ProjectResource')(router, formioServer),
    tag: require('./TagResource')(router, formioServer),
    formrevision: require('./FormRevisionResource')(router, formioServer),
    submissionrevision: require('./SubmissionRevisionResource')(router, formioServer)
  };
};
