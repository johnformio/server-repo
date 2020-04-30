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
const NodeCache = require('node-cache');

const cache = new NodeCache();

// Cache response for 3 hours.
const CACHE_TIME =  process.env.CACHE_TIME || 3 * 60 * 60 * 1000;

module.exports = (formio) => async (req, res, next) => {
  // If this isn't for a project, don't check.
  if (!req.currentProject) {
    return next();
  }

  const projectId = req.currentProject._id.toString();

  try {
    if (cache.get(projectId) && _.has(req.primaryProject, 'settings.licenseKey')) {
      return next();
    }

    let licenseKey = getLicenseKey(req);

    // Always allow access to the formio base project.
    if (req.primaryProject.name === 'formio') {
      return next();
    }

    // If no key, we need to generate a new license.
    if (process.env.FORMIO_HOSTED) {
      const primaryPlan = req.primaryProject.plan;
      if (!licenseKey) {
        const planInstance = new plans[primaryPlan]();
        const data = {
          ...planInstance.getPlan(),
          licenseName: `Hosted - ${req.primaryProject.title}`,
        };

        const license = await createLicense(formio, req, data);

        await new Promise((resolve) => {
          formio.mongoose.models.project.findOne({
            _id: req.primaryProject._id,
          }).exec((err, project) => {
            if (err || !project) {
              return resolve();
            }
            licenseKey = license.data.licenseKeys[0].key;
            project.settings = {
              ...project.settings,
              licenseKey,
            };
            project.save();
            req.licenseKey = licenseKey;
            return resolve();
          });
        });
      }
      // Check if trial license is expired.
      else if (primaryPlan === 'trial') {
        const license = await getLicense(formio, licenseKey);

        if (license.data.plan === 'trial' && license.data.endDate) {
          if (new Date(license.data.endDate) < new Date()) {
            await setLicensePlan(formio, licenseKey, process.env.PROJECT_PLAN);
          }
        }
      }
    }

    // Always allow access to the project endpoint.
    if (req.url === `/project/${req.projectId}`) {
      return next();
    }

    const result = await utilization({
      ...getProjectContext(req),
      licenseKey,
    });

    const plan = _.get(result, 'terms.plan') || 'basic';

    // If the plan is not correct, fix it.
    if (plan !== req.currentProject.plan) {
      req.currentProject.plan = plan;
      await new Promise((resolve) => {
        formio.mongoose.models.project.findOne({
          _id: req.currentProject._id,
        }).exec((err, project) => {
          if (err || !project) {
            return resolve();
          }
          project.plan = plan;
          project.save();
          return resolve();
        });
      });
    }

    // Cache response for 3 hours.
    cache.set(projectId, true, CACHE_TIME);

    return next();
  }
  catch (err) {
    cache.del(projectId);
    return next(err);
  }
};
