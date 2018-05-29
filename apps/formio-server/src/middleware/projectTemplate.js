'use strict';

const _ = require('lodash');
const jwt = require('jsonwebtoken');
const debug = require('debug')('formio:middleware:projectTemplate');

module.exports = function(formio) {
  const hook = require('formio/src/util/hook')(formio);
  return function(req, res, next) {
    // If we are creating a project without a template, use the default template.
    if (res.resource.status === 201 && !req.templateMode) {
      req.templateMode = 'create';
    }
    // If the Project was not created, skip this bootstrapping process.
    if (!req.templateMode) {
      return next();
    }

    // The Project that was just created.
    const project = res.resource.item;
    if (!project) {
      return res.status(400).send('No project found.');
    }

    // The project template they wish to use.
    const template = req.template || 'default';

    // Update the owner of the Project, and give them the Administrator Role.
    const updateProjectOwner = function(template) {
      // Give the project owner all the administrator roles.
      const adminRoles = [];
      const roles = {};
      // Normalize roles and access for processing.
      _.each(template.roles, function(role, name) {
        roles[name] = role._id;
        if (role.admin) {
          adminRoles.push(role._id);
        }
      });
      // Find the Project owner by id, and add the administrator role of this Project to their roles.
      formio.resources.submission.model.findOne({_id: project.owner, deleted: {$eq: null}}, function(err, owner) {
        if (err) {
          debug(err);
          return next(err);
        }

        // If there is no owner, don't update.
        if (!owner) {
          return next();
        }

        // Attempt to remove array with one null element, inserted by mongo.
        owner.roles = _.filter(owner.roles || []);

        // Add the administrative roles of this Project to the creators roles.
        _.each(adminRoles, function(adminRole) {
          owner.roles.push(adminRole._id);
        });

        const roles = owner.roles;
        owner.save(function(err) {
          if (err) {
            debug(err.errors || err);
            return next(err);
          }

          // Update the users jwt token to reflect the user role changes.
          const token = formio.util.getHeader(req, 'x-jwt-token');
          jwt.verify(token, formio.config.jwt.secret, function(err, decoded) {
            if (err) {
              debug(err);
              return next(err);
            }

            // Add the user roles to the token.
            decoded.user.roles = roles;

            // Update req/res tokens.
            req.user = decoded.user;
            req.token = decoded;
            res.token = formio.auth.getToken({
              form: decoded.form,
              user: decoded.user
            });

            res.setHeader('Access-Control-Expose-Headers', 'x-jwt-token');
            res.setHeader('x-jwt-token', res.token);
            return next();
          });
        });
      });
    };

    // Method to import the template.
    const importTemplate = function(template) {
      let _project;
      try {
        _project = project.toObject();
      }
      catch (e) {
        _project = project;
      }

      // Set the project on the template.
      const projectKeys = ['_id', 'title', 'name', 'description', 'machineName'];
      template = _.assign({}, template, _.pick(_project, projectKeys));

      const alters = hook.alter('templateAlters', {});

      // Import the template within formio.
      formio.template.import.template(template, alters, function(err, template) {
        if (err) {
          debug(err);
          return res.status(400).send('An error occurred with the template import.');
        }

        // Reload the project to reflect any changes made by the template.
        formio.resources.project.model.findOne({_id: project._id}, function(err, project) {
          if (err) {
            return res.status(400).send(err);
          }
          res.resource.item = project;

          if (req.templateMode === 'create') {
            // Update the project owner with the admin role.
            return updateProjectOwner(template);
          }

          return next();
        });
      });
    };

    // Allow external templates.
    if (typeof template === 'object') {
      // Import the template.
      return importTemplate(template);
    }
    // New environments should copy their primary project template.
    else if ('project' in project && project.project) {
      formio.cache.loadProject(req, project.project, function(err, primaryProject) {
        formio.template.export({
          projectId: project.project,
          access: primaryProject.access.toObject()
        }, function(err, template) {
          if (err) {
            // If something went wrong, just import the default template instead.
            return importTemplate(_.cloneDeep(formio.templates['default']));
          }
          return importTemplate(template);
        });
      });
    }
    // Check for template that is already provided.
    else if ((typeof template === 'string') && formio.templates.hasOwnProperty(template)) {
      // Import the template.
      return importTemplate(_.cloneDeep(formio.templates[template]));
    }
    else {
      // Unknown template.
      return res.status(400).send('Unknown template.');
    }
  };
};
