'use strict';

const {utilization, getProjectContext, getLicense} = require('../util/utilization');

module.exports = (formio) => async (req, res, next) => {
  // If not sending license, skip.
  if (!req.body || !req.body.settings || !req.body.settings.licenseKey) {
    return next();
  }
  // Changing license key.
  if (!req.currentProject || req.currentProject.settings.licenseKey !== req.body.settings.licenseKey) {
    const license = await getLicense(formio, req.body.settings.licenseKey);
    if (!license) {
      return res.status(400).send('License key not found');
    }
    req.body.plan = license.data.plan;
  }

  // See if the license can be utilized by this project.
  try {
    await utilization({
      ...getProjectContext(req),
      licenseKey: req.body.settings.licenseKey,
    });
  }
  catch (err) {
    return res.status(400).send(err.message);
  }

  return next();
};
