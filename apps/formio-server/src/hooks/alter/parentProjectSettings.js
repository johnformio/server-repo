'use strict';

module.exports = app => async (req, cb) => {
  try {
    const project = await app.formio.formio.cache.loadCache.load(req.projectId);
    if (!project) {
      return cb('Could not find project');
    }

    if (project.type === 'tenant') {
      const parentProject = await app.formio.formio.cache.loadCache.load(project.project);
      return cb(null, parentProject.settings);
    }
    else {
      return cb(null, project.settings);
    }
  }
 catch (err) {
  return cb(err);
  }
};
