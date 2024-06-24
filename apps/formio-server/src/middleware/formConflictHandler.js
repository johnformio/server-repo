'use strict';

const _ = require('lodash');

/**
 * The formConflictHandler middleware.
 *
 * This middleware is used to detect a conflict occurring in saving forms.
 *
 * @param router
 * @returns {Function}
 *
 */
module.exports = function(formio) {
  return async function(req, res, next) {
    const cache = formio.cache;

    if (req.method !== 'PUT' || !req.formId || !_.has(req, 'body.modified') || !_.has(req, 'body.components')) {
      return next();
    }

    try {
      const form = await cache.loadCurrentForm(req);
      if (!form) {
        return next('No form was contained in the current request.');
      }

      // If both times are the same, continue as usual, because no outside modifications have been made since.
      const current = new Date();
      const timeStable = new Date(_.get(form, 'modified', current.getTime())).getTime();
      const timeLocal = new Date(_.get(req, 'body.modified', current.getTime())).getTime();
      if (timeStable <= timeLocal) {
        return next();
      }

      // Since the form has been updated since the last load, return 409 Conflict with the new version of the form.
      return res.status(409).send(form);
    }
    catch (err) {
      return next(err);
    }
  };
};
