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
const CACHE_TIME = process.env.FORMIO_HOSTED ? 0 : process.env.CACHE_TIME || 3 * 60 * 60;

module.exports = (formio) => async (req, res, next) => {
  // If this isn't for a project, don't check.
  if (!req.currentProject) {
    return next();
  }

  const projectId = req.currentProject._id.toString();

  try {
    let licenseKey = getLicenseKey(req);
    const licenseInfo = cache.get(projectId);

    if (licenseInfo && _.has(req.primaryProject, 'settings.licenseKey')) {
      // We are going to evaluate these after going to the next middleware so not to slow down the request. If there is
      // an issue we will clear the cache which will cause the issue to be caught on the next request.
      req.projectLicense = licenseInfo;
      // eslint-disable-next-line callback-return
      next();
      // Check every 5 minutes in case something changes.
      if (process.env.FORMIO_HOSTED && cache.getTtl(projectId) - Date.now() < (CACHE_TIME - 300) * 1000) {
        try {
          const license = await getLicense(formio, licenseKey);
          const result = await utilization({
            ...getProjectContext(req),
            licenseKey,
          });

          // Everything is still good, update the cache info.
          if (license.data.plan === req.primaryProject.plan) {
            cache.set(projectId, result, CACHE_TIME);
          }
          else {
            // Plan has changed. Re-evaluate on next request.
            cache.del(projectId);
          }
        }
        catch (err) {
          // Utilization is now disabled. Re-evaluate on next request.
          cache.del(projectId);
        }
      }
      return;
    }

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
    if (req.url === `/project/${req.projectId}` || req.url === `/project/${req.projectId}/access/remote`) {
      return next();
    }

    // Don't block next middleware execution if we have project utilization in cache
    const cachedProjectUtilization = cache.get(projectId);
    if (cachedProjectUtilization) {
      req.projectLicense = cachedProjectUtilization;
      /* eslint-disable-next-line callback-return */
      next();
    }

    if (!process.env.LICENSE_REMOTE) {
      const result = await utilization({
        ...getProjectContext(req),
        licenseKey,
      });

      req.projectLicense = result;

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
      // Cache response.
      cache.set(projectId, result, CACHE_TIME);
    }
    // Don't call next if we already did it before
    if (!cachedProjectUtilization) {
      return next();
    }
  }
  catch (err) {
    cache.del(projectId);
    res.status(400).send(err);
  }
};
