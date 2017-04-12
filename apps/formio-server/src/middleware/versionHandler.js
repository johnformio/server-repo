'use strict';

/**
 * A handler for form based requests.
 *
 * @param router
 * @returns {Function}
 */
module.exports = function(router) {
  var hook = require('../util/hook')(router.formio);
  var formio = hook.alter('formio', router.formio);

  return function formHandler(req, res, next) {
    hook.invoke('formRequest', req, res);
    if (req.method === 'GET') {
      req.countQuery = req.countQuery || this.model;
      req.modelQuery = req.modelQuery || this.model;
      req.countQuery = req.countQuery.find(hook.alter('formQuery', {}, req));
      req.modelQuery = req.modelQuery.find(hook.alter('formQuery', {}, req));
    }
    next();
  };
};
