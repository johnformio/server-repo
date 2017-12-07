'use strict';

var _ = require('lodash');

module.exports = function(formioServer) {
  var formio = formioServer.formio;
  return function(req, res, next) {
    // Only allow admins to change owner for now.
    if (req.projectId && req.isAdmin && req.adminKey) {
      formio.cache.loadCurrentProject(req, (err, project) => {
        if (err) {
          return next(err);
        }
        if (!project) {
          return res.status(404).send('Project not found');
        }
        project.owner = formioServer.formio.util.idToBson(req.body.owner);
        project.markModified('owner');
        project.save();
        const projectObj = project.toObject();

        formio.resources.role.model.findOne({
          project: projectObj._id,
          title: 'Administrator',
          deleted: {$eq: null}
        }, function(err, adminRole) {
          if (err || !adminRole) {
            return res.send(projectObj);
          }
          // Find the Project owner by id, and add the administrator role of this Project to their roles.
          formio.resources.submission.model.findOne({
            _id: projectObj.owner.toString(),
            deleted: {$eq: null}
          }, function(err, owner) {
            if (err || !owner) {
              return res.send(projectObj);
            }

            // Attempt to remove array with one null element, inserted by mongo.
            owner.roles = _.filter(owner.roles || []);

            // Add the administrative roles of this Project to the creators roles.
            owner.roles.push(adminRole.toObject()._id);

            owner.save(function(err) {
              return res.send(projectObj);
            });
          });
        });
      });
    }
    else {
      return res.status(401).send();
    }
  };
};
