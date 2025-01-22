'use strict';

const _ = require('lodash');

module.exports = function(formio) {
  return async function(req, res, next) {
    if (!req.projectId) {
      try {
        const projects = await formio.resources.project.model.find({
          primary: true
        });

        return res.send(_.map(projects, function(currentProject) {
          const filtered = _.pick(currentProject, ['_id', 'name', 'title', 'description']);
          filtered.url = `${(req.secure || (req.get('X-Forwarded-Proto') === 'https') ? 'https://' : 'http://') + req.headers.host}/project/${filtered._id}`;
          filtered.form = `${(req.secure || (req.get('X-Forwarded-Proto') === 'https') ? 'https://' : 'http://') + req.headers.host}/project/${filtered._id}/form`;
          filtered.alias = `${(req.secure || (req.get('X-Forwarded-Proto') === 'https') ? 'https://' : 'http://') + filtered.name}.${req.headers.host}`;
          return filtered;
        }));
      }
      catch (err) {
        return next(err);
      }
    }
    else {
      return next();
    }
  };
};
