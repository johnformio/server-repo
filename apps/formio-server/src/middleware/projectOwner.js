"use strict";

const _ = require("lodash");
const debug = require("debug")("formio:projectOwner");

module.exports = function(formioServer) {
  const formio = formioServer.formio;
  return async function(req, res, next) {
    // Only allow admins to change owner for now.
    if (req.projectId && req.isAdmin && req.adminKey) {
      const projectObj = await formio.cache.updateProject(req.projectId, {
        owner: formioServer.formio.util.idToBson(req.body.owner),
      });

      try {
        const adminRole = await formio.resources.role.model.findOne({
          project: projectObj._id,
          title: "Administrator",
          deleted: {$eq: null},
        });
        if (!adminRole) {
          return res.json(projectObj);
        }
        // Find the Project owner by id, and add the administrator role of this Project to their roles.
        const owner = await formio.resources.submission.model.findOne({
          _id: projectObj.owner.toString(),
          deleted: {$eq: null},
        });
        if (!owner) {
          return res.json(projectObj);
        }

        // Attempt to remove array with one null element, inserted by mongo.
        owner.roles = _.filter(owner.roles || []);

        // Add the administrative roles of this Project to the creators roles.
        owner.roles.push(adminRole.toObject()._id);

        await formio.resources.submission.model.updateOne(
          {
            _id: owner._id,
          },
          {$push: {roles: owner.roles}},
        );
        return res.json(projectObj);
      }
      catch (err) {
        debug(err);
        return res.json(projectObj);
      }
    }
    else {
      return res.status(401).send();
    }
  };
};
