'use strict';
const config = require('../../config');
module.exports = (formioServer) => (req, res, next) => {
  // Don't change plans on hosted
  if (config.formio.hosted) {
    return next();
  }

  if (req.method !== 'POST') {
    return next();
  }

  // If not attempting to set a plan it will default already.
  if (!req.body.hasOwnProperty('plan')) {
    //child project (stage) must inherit parent`s plan
    if (req.parentProject && req.parentProject.plan && req.body.type === 'stage') {
      req.body.plan = req.parentProject.plan;
    }
    return next();
  }

  const plans = formioServer.formio.plans.getPlans();

  // Don't allow them to set a plan below the default plan.
  if (req.body.plan === 'trial' || plans.indexOf(req.body.plan) < plans.indexOf(formioServer.config.plan)) {
    req.body.plan = formioServer.config.plan;
  }
  next();
};
