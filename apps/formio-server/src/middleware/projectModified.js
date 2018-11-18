'use strict';

const debug = require('debug')('formio:middleware:projectModified');

module.exports = function(formio) {
  /**
   * Formio Middleware to change the modified date of a project if the project definition has changed..
   */
  return function(req, res, next) {
    // Only modify for put and post requests.
    if (req.method === 'GET') {
      return next();
    }

    formio.cache.loadCurrentProject(req, function(err, project) {
      if (err) {
        debug('Unable to load project');
        return next();
      }

      formio.resources.project.model.findOne({
        _id: project._id,
        deleted: {$eq: null}
      }, (err, doc) => {
        if (err) {
          debug('Error loading project', err);
          return next();
        }
        // If form doesn't exist or revisions are disabled, don't worry about revisions.
        if (!doc) {
          debug('No doc found');
          return next();
        }

        // Trigger a save which should update the modified date.
        doc.markModified('modified');
        doc.save();
        return next();
      });
    });
  };
};
