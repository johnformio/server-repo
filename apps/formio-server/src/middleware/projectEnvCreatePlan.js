'use strict';

const debug = require('debug')('formio:middleware:projectEnvCreatePlan');

module.exports = function(formio) {
  return function(req, res, next) {
    // If this is a project, not an environment.
    if (!('project' in req.body)) {
      return next();
    }

    formio.plans.getPlan(req, function(err, plan) {
      if (err || !plan) {
        debug(err || 'Project plan not found.');
        return next(err || 'Project plan not found.');
      }

      debug(plan);
      switch (plan.toString()) {
        case 'commercial':
        case 'trial':
          return next();
        case 'team':
        case 'independent':
        case 'basic':
        default:
          return res.status(402).send('Environments can only be created on a Commercial or higher plan.');
      }
    });
  };
};
