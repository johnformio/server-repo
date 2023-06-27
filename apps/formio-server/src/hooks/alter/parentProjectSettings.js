'use strict';

module.exports = app => (req, cb) => {
    app.formio.formio.cache.loadCache.load(req.projectId, function(err, project) {
    if (err) {
      return cb(err);
    }
    if (!project) {
      return cb('Could not find project');
    }

    if (project.type === 'tenant') {
      app.formio.formio.cache.loadCache.load(project.project, (err, parentProject)=>{
        if (err) {
          return cb(err);
        }
        return cb(null, parentProject.settings);
      });
    }
    else {
      return cb(null, project.settings);
    }
  });
};
