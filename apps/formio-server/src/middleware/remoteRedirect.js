'use strict';

module.exports = app => (req, res, next) => {
  const cache = require('../cache/cache')(app.formio);

  // Paths to let through.
  if (['/', '/role', '/access/remote'].indexOf(req.url) !== -1) {
    return next();
  }

  const projectPath = function(project, serverBase, type) {
    const server = serverBase.replace(/(^\w+:|^)\/\//, '');
    const protocol = serverBase.indexOf('https') === 0 ? 'https:' : 'http:';

    let path;
    switch (type) {
      case 'Subdomains':
        if (project.hasOwnProperty('name')) {
          path = protocol + '//' + project.name + '.' + server;
        }
        else if (project.hasOwnProperty('_id')) {
          path = serverBase + '/project/' + project._id;
        }
        break;
      case 'Subdirectories':
        if (project.hasOwnProperty('name')) {
          path = serverBase + '/' + project.name;
        }
        else if (project.hasOwnProperty('_id')) {
          path = serverBase + '/project/' + project._id;
        }
        break;
      case 'ProjectId':
        path = serverBase + '/project/' + project._id;
        break;
    }
    return path;
  };

  cache.loadCurrentProject(req, function(err, project) {
    const currentProject = project.toObject();
    if (currentProject.remote) {
      return res.redirect(301, projectPath(
          currentProject.remote.project,
          currentProject.remote.url,
          currentProject.remote.type
        ) + req.url);
    }
    else {
      return next();
    }
  });
};
