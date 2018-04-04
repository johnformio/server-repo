'use strict';

const kickboxValidate = require('../../actions/kickbox/validate');

module.exports = app => (component, path, req, res, next) => {
  if (
    (component.type === 'email') &&
    component.kickbox &&
    component.kickbox.enabled
  ) {
    // Load the project settings.
    app.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
      if (err) {
        return next(err);
      }
      if (!project) {
        return res.status(400).send('Could not find project');
      }

      // Validate with kickbox.
      kickboxValidate(project, component, path, req, res, next);
    });

    // Return true so that we can handle this request.
    return true;
  }

  // Return false to move on with the request.
  return false;
};
