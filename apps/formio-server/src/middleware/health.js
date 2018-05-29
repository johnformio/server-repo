'use strict';

module.exports = function(formio) {
  return function(req, res, next) {
    if (!formio.resources) {
      return res.status(500).send('No Resources');
    }
    if (!formio.resources.project.model) {
      return res.status(500).send('No Project model');
    }

    // Proceed with db schema sanity check middleware.
    return next();
  };
};
