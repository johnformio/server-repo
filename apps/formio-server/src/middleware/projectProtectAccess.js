'use strict';

module.exports = function(formio) {
  return async function(req, res, next) {
    // GET requests aren't modifications.
    if (req.method === 'GET') {
      return next();
    }

    try {
      const project = await formio.cache.loadCurrentProject(req);
      if (!project) {
        throw new Error('Project not found.');
      }
      if ('protect' in project && project.protect) {
        return res.status(403).send('Modifications not allowed. Project is protected.');
      }
      return next();
    }
    catch (err) {
      return next(err);
    }
  };
};
