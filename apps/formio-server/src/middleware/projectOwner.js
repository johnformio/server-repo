'use strict';

module.exports = function(formioServer) {
  var formio = formioServer.formio;
  var cache = require('../cache/cache')(formio);
  return function(req, res, next) {
    // Only allow access key to change owner for now.
    if (req.projectId && process.env.ACCESS_KEY && process.env.ACCESS_KEY === req.headers['access-key']) {
      cache.loadCurrentProject(req, (err, project) => {
        if (err) {
          return next(err);
        }
        if (!project) {
          return res.status(404).send('Project not found');
        }
        project.owner = formioServer.formio.util.idToBson(req.body.owner);
        project.markModified('owner');
        project.save();
        return res.send(project.toObject());
      });
    }
    else {
      return res.status(401).send();
    }
  };
};
