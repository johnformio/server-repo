'use strict';

const config = require('../../../config');
const _ = require('lodash');

module.exports = router => async (accessInfo, next) => {
  // Allow filtering to be disabled with environmental variable, with optional project settings override
  const projectSettings = _.get(accessInfo, 'req.currentProject.settings', {});
  accessInfo.filterEnabled = _.defaultTo(projectSettings.filterAccess, config.filterAccess);

  // If filtering is enabled, do project-level filtering here before passing it back to core server
  if (accessInfo.filterEnabled) {
    const userAccess = _.get(accessInfo, 'req.userAccess');

    // Remove info if the requester's roles don't have any overlap with general project-level read access
    if (_.get(userAccess, 'project') && !_.intersection(userAccess.project.read_all, userAccess.roles).length) {
      accessInfo.forms = {};
    }
  }

  next(null, accessInfo);
};
