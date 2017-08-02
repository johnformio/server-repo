'use strict';

var request = require('request');
var _ = require('lodash');
var jwt = require('jsonwebtoken');
var isURL = require('is-url');
var debug = require('debug')('formio:middleware:projectTemplate');

module.exports = function(formio) {
  var hook = require('formio/src/util/hook')(formio);
  var cache = require('../cache/cache')(formio);
  return function(req, res, next) {
    // If we are creating a project without a template, use the default template.
    if (res.resource.status === 201 && !req.templateMode) {
      req.templateMode = 'create';
    }
    // If the Project was not created, skip this bootstrapping process.
    debug('Template Mode: ' + req.templateMode);
    if (!req.templateMode) {
      debug('Skipping template import');
      return next();
    }

    // The Project that was just created.
    var project = res.resource.item;
    if (!project) {
      return res.status(400).send('No project found.');
    }

    // The project template they wish to use.
    var template = req.template || 'default';

    // Update the owner of the Project, and give them the Administrator Role.
    var updateProjectOwner = function(template) {
      // Give the project owner all the administrator roles.
      var adminRoles = [];
      var roles = {};
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

        var roles = owner.roles;
        owner.save(function(err) {
          if (err) {
            debug(err.errors || err);
            return next(err);
          }

          // Update the users jwt token to reflect the user role changes.
          var token = formio.util.getHeader(req, 'x-jwt-token');
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
    var importTemplate = function(template) {
      var _debug = require('debug')('formio:middleware:projectTemplate#importTemplate');
      _debug(JSON.stringify(template));

      let _project;
      try {
        _project = project.toObject();
      }
      catch (e) {
        _project = project;
      }

      // Set the project on the template.
      let projectKeys = ['_id', 'title', 'name', 'description', 'machineName'];
      template = _.assign({}, template, _.pick(_project, projectKeys));
      debug('import template', template);

      let alters = hook.alter('templateAlters', {});

      // Import the template within formio.
      formio.template.import.template(template, alters, function(err, template) {
        if (err) {
          _debug(err);
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
    debug('template: ' + template + ', typeof ' + typeof template);
    if (typeof template === 'object') {
      debug('importing object');
      // Import the template.
      return importTemplate(template);
    }
    // Allow templates from http://help.form.io/templates.
    else if (isURL(template)) {
      debug('importing URL');
      return request({
        url: template,
        json: true
      }, function(err, response, body) {
        if (err) {
          debug(err);
          return next(err.message || err);
        }

        if (response.statusCode !== 200) {
          return res.status(400).send('Unable to load template.');
        }

        // Import the template.
        return importTemplate(body);
      });
    }
    // New environments should copy their primary project template.
    else if ('project' in project && project.project) {
      debug('importing primary project');
      cache.loadProject(req, project.project, function(err, primaryProject) {
        formio.template.export({
          projectId: project.project,
          access: primaryProject.access.toObject()
        }, function(err, template) {
          debug('importing from primary', template);
          if (err) {
            // If something went wrong, just import the default template instead.
            return importTemplate(_.cloneDeep(formio.templates['default']));
          }
          return importTemplate(template);
        });
      });
    }
    // Check for template that is already provided.
    else if (formio.templates.hasOwnProperty(template)) {
      debug('importing template:' + template);
      // Import the template.
      return importTemplate(_.cloneDeep(formio.templates[template]));
    }
    else {
      debug('importing nothing!');
      // Unknown template.
      return res.status(400).send('Unknown template.');
    }
  };
};
