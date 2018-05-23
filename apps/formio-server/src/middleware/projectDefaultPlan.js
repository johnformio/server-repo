'use strict';

module.exports = function(formioServer) {
  return function(req, res, next) {
    // Don't change plans on hosted
    if (process.env.FORMIO_HOSTED) {
      return next();
    }

    if (!req.method === 'POST') {
      return next();
    }

    // If not attempting to set a plan it will default already.
    if (!req.body.hasOwnProperty('plan')) {
      return next();
    }

    const plans = formioServer.formio.plans.getPlans();

    // Don't allow them to set a plan below the default plan.
    if (req.body.plan === 'trial' || plans.indexOf(req.body.plan) < plans.indexOf(formioServer.config.plan)) {
      req.body.plan = formioServer.config.plan;
    }
    next();
  };
};
