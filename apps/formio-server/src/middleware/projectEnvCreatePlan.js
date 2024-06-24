'use strict';

module.exports = function(formio) {
  return async function(req, res, next) {
    // If this is a project, not an environment.
    if (!('project' in req.body)) {
      return next();
    }

    try {
      const {plan} = await formio.plans.getPlan(req);
      if (!plan) {
        return next('Project plan not found.');
      }

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
    }
    catch (err) {
      return next(err);
    }
  };
};
