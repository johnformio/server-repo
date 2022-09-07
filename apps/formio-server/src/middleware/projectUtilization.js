/* eslint-disable max-depth */
'use strict';
const {
  utilization,
  getProjectContext,
  getLicenseKey,
  licenseConfig
} = require('../util/utilization');

module.exports = (app) => (req, res, next) => {
  if (licenseConfig.remote) {
    return next();
  }

  // If this isn't for a project, don't check.
  if (!req.currentProject) {
    return next();
  }

  // Always allow access to the formio base project.
  if (req.primaryProject && req.primaryProject.name === 'formio') {
    return next();
  }

  const projectId = req.currentProject._id.toString();
  const licenseKey = getLicenseKey(req);
  const licenseInfo = utilization(app, `project:${projectId}`, {
    ...getProjectContext(req),
    licenseKey,
  });

  if (licenseInfo && licenseInfo.error) {
    return res.status(400).send(licenseInfo.error.message);
  }

  // Allow the license info to achieve the cache.
  if (licenseKey && !licenseInfo) {
    return next();
  }

  if (licenseInfo) {
    req.projectLicense = licenseInfo;
  }

  /* eslint-disable callback-return */
  next();
};
