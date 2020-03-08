'use strict';

const _ = require('lodash');

/**
 * The formRevisionUpdate middleware.
 *
 * This middleware is used to automatically update the revision of sub forms when revisions are turned on.
 *
 * @param router
 * @returns {Function}
 *
 */
module.exports = function(formio) {
  return function(req, res, next) {
    const cache = formio.cache;

    if (req.method !== 'PUT' || !req.formId || !_.has(req, 'body.revisions') || !_.has(req, 'body.components')) {
      return next();
    }

    // Only run if revisinos is set.
    if (!['current', 'original'].includes(req.body.revisions)) {
      return next();
    }

    const promises = [];

    formio.util.eachComponent(req.body.components, (component) => {
      if (component.type === 'form') {
        promises.push(new Promise((resolve, reject) => {
          formio.cache.loadForm(req, null, component.form, (err, form) => {
            if (err || !form) {
              component.formRevision = 0;
              return resolve();
            }
            component.formRevision = form._vid;
            return resolve();
          });
        }));
      }
    });

    Promise.all(promises).then(() => next());
  };
};
