'use strict';

const {utilization, getProjectContext, getLicenseKey} = require('../util/utilization');

function middleware(formio) {
  return async (req, res, next) => {
    // If project is made remote, disable it.
    if (!req.currentProject.remote && req.body.remote && req.currentProject.project) {
      try {
        await utilization({
          ...getProjectContext(req),
          licenseKey: getLicenseKey(req),
        }, '/disable');
      }
      catch (err) {
        // Swallow error.
      }
    }

    // If a project is no longer remote, re-enable it.
    if (req.currentProject.remote && !req.body.remote) {
      // This is not needed on local but breaks for some reason on production.
      req.skipLicense = true;
      try {
        await utilization({
          ...getProjectContext(req),
          licenseKey: getLicenseKey(req),
        }, '/enable');
      }
      catch (err) {
        // Swallow error.
      }
    }
    return next();
  };
}

module.exports = {
  middleware,
};
