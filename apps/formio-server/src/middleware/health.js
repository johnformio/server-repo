'use strict';

module.exports = function(formio) {
  return function(req, res, next) {
    if (!formio.resources) {
      if (req.verboseHealth) {
        res.status(500);
      }
      else {
        return res.status(500).send('No Resources');
      }
    }
    if (!formio.resources.project.model) {
      if (req.verboseHealth) {
        res.status(500);
      }
      else {
        return res.status(500).send('No Project model');
      }
    }

    // Proceed with db schema sanity check middleware.
    return next();
  };
};
