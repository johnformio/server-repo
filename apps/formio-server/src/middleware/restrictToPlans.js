'use strict';

module.exports = function(router) {
  return function(plans) {
    return async function(req, res, next) {
      try {
        const {plan} = await router.formio.formio.plans.getPlan(req);
        if (!plan) {
          return next('Project plan not found.');
        }

        if (plans.indexOf(plan) === -1) {
          return res.sendStatus(402);
        }
        return next();
    }
    catch (err) {
      return next(err);
      }
    };
  };
};
