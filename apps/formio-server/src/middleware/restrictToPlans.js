'use strict';

var debug = require('debug')('formio:middleware:restrictToPlans');

module.exports = function(router) {
  return function(plans) {
    return function(req, res, next) {
      router.formio.formio.plans.getPlan(req, function(err, plan) {
        if (err || !plan) {
          debug(err || 'Project plan not found.');
          return next(err || 'Project plan not found.');
        }

        if (plans.indexOf(plan) === -1) {
          return res.sendStatus(402);
        }
        next();
      });
    };
  };
};
