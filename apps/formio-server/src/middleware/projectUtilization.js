/* eslint-disable max-depth */
'use strict';
const {
  utilization,
  getProjectContext,
  getLicenseKey,
  createLicense,
  getLicense,
  setLicensePlan,
} = require('../util/utilization');
const _ = require('lodash');
const plans = require('../plans/plans');
const license = require('../util/license');

module.exports = (app) => (req, res, next) => {
  const formio = app.formio.formio;
  // If this isn't for a project, don't check.
  if (!req.currentProject) {
    return next();
  }

  // Always allow access to the formio base project.
  if (req.primaryProject.name === 'formio') {
    return next();
  }

  if (app.license.remote) {
    return next();
  }

  const projectId = req.currentProject._id.toString();
  let licenseKey = getLicenseKey(req);
  const licenseInfo = utilization(`project:${projectId}`, {
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

  const postProcess = async function() {
    // If no key, we need to generate a new license.
    if (process.env.FORMIO_HOSTED) {
      let primaryPlan = req.primaryProject.plan;
      if (!licenseKey) {
        if (!plans.hasOwnProperty(primaryPlan)) {
          primaryPlan = 'trial';
        }
        const license = await createLicense(formio, req, {
          ...(new plans[primaryPlan]()).getPlan(),
          licenseName: `Hosted - ${req.primaryProject.title}`,
        });

        formio.mongoose.models.project.findOne({
          _id: req.primaryProject._id,
        }).exec((err, project) => {
          if (err || !project) {
            return;
          }
          licenseKey = license.data.licenseKeys[0].key;
          project.settings = {
            ...project.settings,
            licenseKey,
          };
          project.save();
          req.licenseKey = licenseKey;
        });
      }
      // Check if trial license is expired.
      else if (primaryPlan === 'trial') {
        const license = await getLicense(formio, licenseKey);
        if (license.data.plan === 'trial' && license.data.endDate) {
          if (new Date(license.data.endDate) < new Date()) {
            setLicensePlan(formio, licenseKey, process.env.PROJECT_PLAN);
          }
        }
      }

      if (licenseInfo && !licenseInfo.error) {
        const plan = _.get(licenseInfo, 'terms.plan') || 'basic';

        // If the plan is not correct, fix it.
        if (plan !== req.currentProject.plan) {
          req.currentProject.plan = plan;
          formio.mongoose.models.project.findOne({
            _id: req.currentProject._id,
          }).exec((err, project) => {
            if (err || !project) {
              return;
            }
            project.plan = plan;
            project.save();
          });
        }
      }
    }
  };

  // Perform the post processing.
  postProcess();
};
