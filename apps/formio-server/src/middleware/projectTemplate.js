'use strict';

var request = require('request');
var _ = require('lodash');
var jwt = require('jsonwebtoken');
var isURL = require('is-url');
var debug = require('debug')('formio:middleware:projectTemplate');

module.exports = function(formio) {
  var hook = require('formio/src/util/hook')(formio);
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
      return next('No project found.');
    }

    // The project template they wish to use.
    var template = req.template || 'default';

    // Update the owner of the Project, and give them the Administrator Role.
    var updateProjectOwner = function(template, adminRoles) {
      // Find the Project owner by id, and add the administrator role of this Project to their roles.
      formio.resources.submission.model.findOne({_id: project.owner, deleted: {$eq: null}}, function(err, owner) {
        if (err) {
          debug(err);
          return next(err);
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
            debug(err);
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

    // Update the Project and attach the anonymous role as the default Role.
    var updateProject = function(template) {
      // Give the project owner all the administrator roles.
      var adminRoles = [];
      var roles = {};
      var accessList = {};
      // Normalize roles and access for processing.
      _.each(template.roles, function(role, name) {
        roles[name] = role._id;
        if (role.admin) {
          adminRoles.push(role._id);
        }
      });

      if (template.access) {
        _.each(template.access, function(access) {
          accessList[access.type] = access.roles;
        });
      }

        // Set project access
      _.each(['create_all', 'read_all', 'update_all', 'delete_all'], function(permission) {
        var access = {
          type: permission,
          roles: []
        };
        access.roles = _.clone(adminRoles);
        if (accessList[permission]) {
          _.each(accessList[permission], function(role) {
            if (access.roles.indexOf(roles[role]) === -1) {
              access.roles.push(roles[role]);
            }
          });
        }
        project.access.push(access);
      });

      // Save preview info to settings if available
      if (template.preview) {
        var settings = _.cloneDeep(project.settings);
        settings.preview = template.preview;
        project.set('settings', settings);
      }

      // Save the project.
      project.save(function(err) {
        if (err) {
          debug(err);
          return next(err);
        }

        // Update the project owner with the admin roles.
        updateProjectOwner(template, adminRoles);
      });
    };

    // Method to import the template.
    var importTemplate = function(template) {
      var _debug = require('debug')('formio:middleware:projectTemplate#importTemplate');
      _debug(template);

      // Set the project on the template.
      template.project = project;

      // Import the template within formio.
      formio.import.template(template, {
        role: function(item, done) {
          item.project = project._id;
          hook.alter('roleMachineName', item.machineName, item, function(err, machineName) {
            if (err) {
              return done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        },
        form: function(item, done) {
          item.project = project._id;
          hook.alter('formMachineName', item.machineName, item, function(err, machineName) {
            if (err) {
              return done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        },
        action: function(item, done) {
          hook.alter('actionMachineName', item.machineName, item, function(err, machineName) {
            if (err) {
              return done(err);
            }

            item.machineName = machineName;
            done(null, item);
          });
        }
      }, function(err, template) {
        if (err) {
          _debug(err);
          return next('An error occurred with the template import.');
        }

        if (req.templateMode === 'create') {
          // Update the project with this template.
          return updateProject(template);
        }

        _debug('FINAL=')
        _debug(template)
        return next();
      });
    };

    // Allow external templates.
    debug('template: ' + template + ', typeof ' + typeof template);
    if (typeof template === 'object') {
      // Import the template.
      return importTemplate(template);
    }
    // Allow templates from http://help.form.io/templates.
    if (isURL(template)) {
      return request({
        url: template,
        json: true
      }, function(err, response, body) {
        if (err) {
          debug(err);
          return next(err.message || err);
        }

        if (response.statusCode !== 200) {
          return next('Unable to load template.');
        }

        // Import the template.
        return importTemplate(body);
      });
    }
    // Check for template that is already provided.
    if (formio.templates.hasOwnProperty(template)) {
      // Import the template.
      return importTemplate(_.cloneDeep(formio.templates[template]));
    }

    // Unknown template.
    return next('Unknown template.');
  };
};
