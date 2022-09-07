'use strict';

const {getEnvironmentId} = require('../util/license');

module.exports = app => async (req, res, next) => {
  if (req.body.environmentId) {
    return next();
  }

  // If this isn't for a project, don't check.
  if (!req.currentProject) {
    return next();
  }

  const environmentId = await getEnvironmentId(app);
  req.body.environmentId = environmentId;
  return next();
};
