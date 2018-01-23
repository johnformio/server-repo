'use strict';

const debug = require('debug')('formio:middleware:projectProtectAccess');

module.exports = function(formio) {
  return function(req, res, next) {
    // GET requests aren't modifications.
    if (req.method === 'GET') {
      return next();
    }

    formio.cache.loadCurrentProject(req, function(err, project) {
      if (err) {
        return next(err);
      }
      if ('protect' in project && project.protect) {
        return res.status(403).send('Modifications not allowed. Project is protected.');
      }
      return next();
    });
  };
};
