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
          return res.status(400).send(err);
        }

        // Reload the project to reflect any changes made by the template.
        formio.resources.project.model.findOne({_id: project._id}, function(err, project) {
          if (err) {
            return res.status(400).send(err);
          }
          res.resource.item = project;

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
      if (req.body.hasOwnProperty('copyFromProject') && req.body.copyFromProject === 'empty') {
        return importTemplate(_.cloneDeep(formio.templates['empty']));
      }

      let projectId = project.project;

      if (req.body.hasOwnProperty('copyFromProject') && req.body.copyFromProject !== formio.util.idToString(project.project)) {
        projectId = formio.util.idToBson(req.body.copyFromProject);
      }

      formio.cache.loadProject(req, projectId, function(err, primaryProject) {
        formio.template.export({
          projectId: projectId,
          access: primaryProject.access ? primaryProject.access.toObject() : [],
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
