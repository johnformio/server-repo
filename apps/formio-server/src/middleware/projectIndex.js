'use strict';

module.exports = function(formio) {
  return function(req, res, next) {
    if (!Boolean(req.projectId)) {
      formio.resources.project.model.find({
        primary: true
      }, function(err, projects) {
        if (err) {
          return next(err);
        }
        return res.send(_.map(projects, function(currentProject) {
          var filtered = _.pick(currentProject, ['_id', 'name', 'title', 'description']);
          filtered.url = (req.secure || (req.get('X-Forwarded-Proto') === 'https') ? 'https://' : 'http://') + req.headers.host + '/project/' + filtered._id;
          filtered.form = (req.secure || (req.get('X-Forwarded-Proto') === 'https') ? 'https://' : 'http://') + req.headers.host + '/project/' + filtered._id + '/form';
          filtered.alias = (req.secure || (req.get('X-Forwarded-Proto') === 'https') ? 'https://' : 'http://') + filtered.name + '.' + req.headers.host;
          return filtered;
        }));
      });
    }
    else {
      return next();
    }
  };
};
