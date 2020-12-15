'use strict';

module.exports = function(formio) {
  return function(req, res, next) {
    if (req.body.project && !req.body.type) {
      req.body.type = 'stage';
    }

    if (req.body.type !== 'stage') {
      return next();
    }

    if (!req.body.project) {
      return next('Parent project not found.');
    }

    formio.mongoose.model('project')
      .findById(req.body.project)
      .then((project) => {
        if (project) {
          return next();
        }

        next('No such parent project.');
      })
      .catch(next);
  };
};
