'use strict';
const config = require('../../config');
module.exports = (formioServer) => async (req, res, next) => {
  if (req.method !== 'POST') {
    return next();
  }
  //child project (stage) must inherit parent`s plan
  if (req.parentProject && req.parentProject.plan && req.body.type === 'stage') {
    req.body.plan = req.parentProject.plan;
  }
  // Don't change plans on hosted
  if (config.formio.hosted) {
    return next();
  }

  // If not attempting to set a plan it will default already.
  if (!req.body.hasOwnProperty('plan')) {
    return next();
  }

  const plans = await formioServer.formio.plans.getPlans();

  // Don't allow them to set a plan below the default plan.
  if (req.body.plan === 'trial' || plans.indexOf(req.body.plan) < plans.indexOf(formioServer.config.plan)) {
    req.body.plan = formioServer.config.plan;
  }
  next();
};
