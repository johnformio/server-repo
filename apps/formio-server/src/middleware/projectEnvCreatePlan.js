'use strict';

module.exports = function(formio) {
  return function(req, res, next) {
    // If this is a project, not an environment.
    if (!('project' in req.body)) {
      return next();
    }

    formio.plans.getPlan(req, function(err, plan) {
      if (err || !plan) {
        return next(err || 'Project plan not found.');
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
    });
  };
};
