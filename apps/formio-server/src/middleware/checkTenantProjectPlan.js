'use strict';

module.exports = function(formio) {
  return function(req, res, next) {
    if (req.body.type !== 'tenant') {
      return next();
    }

    if (req.headers.hasOwnProperty('x-remote-token')) {
      return next();
    }

    if (!('project' in req.body)) {
      return next('Parent project not found.');
    }

    formio.mongoose.model('project').findOne({
      _id: req.body.project,
      plan: 'commercial'
    }).then((project) => {
      if (project) {
        return next();
      }

      next('Tenants can only be created on Commercial project plan.');
    });
  };
};
