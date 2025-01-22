'use strict';

module.exports = (formio) => async (req, res, next) => {
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

  try {
    const loadCurrentProject = async () => {
      try {
        const currentProject = await formio.cache.loadCurrentProject(req);

        if (currentProject) {
          req.currentProject = currentProject;
          const roles = await formio.resources.role.model.find(
            formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req)
          ).sort({title: 1}).lean().exec();
          if (roles) {
            req.currentProject.roles = roles;
          }
        }
      }
      catch (ignoreErr) {
        return;
      }
    };

    const loadParentProject = async () => {
      try {
        const parentProject = await formio.cache.loadParentProject(req);
        if (parentProject) {
          req.parentProject = parentProject;
        }
      }
      catch (ignoreErr) {
        return;
      }
    };

    const loadPrimaryProject = async () => {
      try {
        const primaryProject = await formio.cache.loadPrimaryProject(req);
        if (primaryProject) {
          req.primaryProject = primaryProject;
        }
      }
      catch (ignoreErr) {
        return;
      }
    };

    await Promise.all([
      loadCurrentProject(),
      loadParentProject(),
      loadPrimaryProject()
    ]);

    return next();
  }
  catch (err) {
    return next(err);
  }
};
