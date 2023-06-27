'use strict';

module.exports = (formio) => (req, res, next) => {
  // If there is no projectId, don't error out, just skip loading the current project.
  let projectId = req.projectId;
  if (req.params.projectId) {
    projectId = req.params.projectId;
  }
  if (!projectId && req.body && req.body.project) {
    projectId = req.body.project;
  }
  if (!projectId) {
    return next();
  }

  const promises = [
    new Promise((resolve, reject) => {
      formio.cache.loadCurrentProject(req, function(err, currentProject) {
        // TODO: why do we not resolve with an error here (or reject)?
        if (err || !currentProject) {
          return resolve();
        }
        req.currentProject = currentProject;
        formio.resources.role.model.find(
          formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req)
        )
          .sort({title: 1})
          .lean()
          .exec((err, roles) => {
            if (err || !roles) {
              return resolve();
            }
            req.currentProject.roles = roles;
            return resolve();
          });
      });
    }),
    new Promise((resolve, reject) => {
      formio.cache.loadParentProject(req, function(err, parentProject) {
        if (err || !parentProject) {
          return resolve();
        }
        req.parentProject = parentProject;
        return resolve();
      });
    }),
    new Promise((resolve, reject) => {
      formio.cache.loadPrimaryProject(req, function(err, primaryProject) {
        if (err || !primaryProject) {
          return resolve();
        }
        req.primaryProject = primaryProject;
        return resolve();
      });
    }),
  ];

  Promise.all(promises).then(() => next());
};
