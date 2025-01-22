'use strict';

const {utilization, getLicenseKey} = require('../util/utilization');
const getProjectContext = require('../util/getProjectContext');

function middleware(formio) {
  return (req, res, next) => {
    // If project is made remote, disable it.
    if (!req.currentProject.remote && req.body.remote && req.currentProject.project) {
      utilization(formio, `project:${req.currentProject._id}`, {
        ...getProjectContext(req),
        licenseKey: getLicenseKey(req),
      }, '/disable');
    }

    // If a project is no longer remote, re-enable it.
    if (req.currentProject.remote && !req.body.remote) {
      utilization(formio, `project:${req.currentProject._id}`, {
        ...getProjectContext(req),
        licenseKey: getLicenseKey(req),
      }, '/enable');
    }
    return next();
  };
}

module.exports = {
  middleware,
};
