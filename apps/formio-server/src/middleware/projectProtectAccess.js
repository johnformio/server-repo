'use strict';

var debug = require('debug')('formio:middleware:projectProtectAccess');

module.exports = function(formio) {
  return function(req, res, next) {
    // GET requests aren't modifications.
    if (req.method === 'GET') {
      return next();
    }

    formio.cache.loadCurrentProject(req, function(err, project) {
      debug('Entering Protect Test');
      if (err) {
        return next(err);
      }
      if ('protect' in project && project.protect) {
        debug('Project is protected');
        return res.status(403).send('Modifications not allowed. Project is protected.');
      }
      debug('Project not protected');
      return next();
    });
  };
};
