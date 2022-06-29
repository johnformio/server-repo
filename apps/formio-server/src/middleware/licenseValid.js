'use strict';

const {utilizationSync, getProjectContext, getLicense} = require('../util/utilization');

module.exports = (formio) => async (req, res, next) => {
  // If not sending license, skip.
  if (!req.body || !req.body.settings || !req.body.settings.licenseKey) {
    return next();
  }
  // Changing license key.
  if (!req.currentProject || req.currentProject.settings.licenseKey !== req.body.settings.licenseKey) {
    try {
      const license = await getLicense(formio, req.body.settings.licenseKey);
      if (!license) {
        return res.status(400).send('License key not found');
      }
      req.body.plan = license.data.plan;
    }
    catch (err) {
      return next(err);
    }
  }

  const result = await utilizationSync(formio, `project:${req.currentProject._id}`, {
    ...getProjectContext(req),
    licenseKey: req.body.settings.licenseKey,
  });
  if (result.error) {
    return res.status(400).send(result.error.message);
  }

  return next();
};
