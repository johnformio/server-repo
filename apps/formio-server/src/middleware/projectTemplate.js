'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectTemplate');

function mergeAccess(targetAccess, sourceAccess) {
  // merge access; ensure unique entries by using Map/Set
  const validatedTargetAccess = targetAccess ? [...targetAccess] : [];
  const validatedSourceAccess = sourceAccess ? [...sourceAccess] : [];
  return [...validatedTargetAccess.concat(validatedSourceAccess).reduce((map, curr) => {
    const existingRoles = map.get(curr.type) ? map.get(curr.type).roles || [] : [];
    map.set(curr.type, {type: curr.type, roles: [...new Set([...existingRoles, ...curr.roles])]});
    return map;
  }, new Map()).values()];
}

function provideFormsWithDefaultAccess(targetForms, sourceForms, roles) {
  return Object.entries(targetForms).reduce((acc, [formKey, form]) => {
    // if our source template has the form, merge the access
    if (sourceForms[formKey]) {
      return {...acc, [formKey]: {
        ...form,
        access: mergeAccess(form.access, sourceForms[formKey].access),
        submissionAccess: mergeAccess(form.submissionAccess, sourceForms[formKey].submissionAccess)
      }};
    }
    // otherwise provide a default//
    // TODO: grabbed this from bootstrapFormAccess, good candidate for a constant
    const defaultFormAccess = [{type: 'read_all', roles: Object.keys(roles)}];
    return {...acc, [formKey]: {...form, access: [...defaultFormAccess], submissionAccess: []}};
  }, {});
}

module.exports = function(formio, app) {
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

    if (res.resource.error) {
      return res.status(400).json(res.resource.error);
    }
    // The Project that was just created.
    const project = res.resource.item;
    if (!project) {
      return res.status(400).send('No project found.');
    }

    const defaultTemplateName = 'default';
    // The project template they wish to use.
    const template = req.template || defaultTemplateName;

    // Method to import the template.
    const importTemplate = function(template) {
      let _project;
      try {
        _project = project.toObject();
      }
      catch (e) {
        _project = project;
      }

      const done = (err, template) => {
        if (err) {
          debug(err);
          return res.status(400).send(err);
        }

        // Reload the project to reflect any changes made by the template.
        formio.cache.loadCache.load(project._id, function(err, project) {
          if (err) {
            return res.status(400).send(err);
          }
          res.resource.item = project;

          return next();
         }, true);
      };

      const importTemplateToProject = (template, project, alters) => {
        // Set the project on the template.
        const projectKeys = ['_id', 'title', 'name', 'description', 'machineName'];
        template = _.assign({}, template, _.pick(project, projectKeys));
        // Import the template within formio.
        formio.template.import.template(template, alters, done);
      };

      if (template.excludeAccess) {
        const defaultTemplate = _.cloneDeep(formio.templates[defaultTemplateName]);
        template = {
          ...template,
          access: mergeAccess(template.access, defaultTemplate.access),
          forms: provideFormsWithDefaultAccess(template.forms, defaultTemplate.forms, template.roles),
          resources: provideFormsWithDefaultAccess(template.resources, defaultTemplate.resources, template.roles)
        };
      }
      const alters = hook.alter('templateAlters', {});
      const components = Object.values(template.forms).concat(Object.values(template.resources));
      const missingForms = formio.template.import.checkTemplate(components, template);

      if (missingForms.length !== 0 ) {
        formio.template.import.findProjectId(template)
        .then((projectId)=>{
          formio.template.import.tryToLoadComponents(missingForms, template, projectId);
          importTemplateToProject(template, _project, alters);
        });
      }
      else {
        importTemplateToProject(template, _project, alters);
      }
    };
    // Allow external templates.
    if (typeof template === 'object') {
      // Import the template.
      return importTemplate(template);
    }
    // New environments should copy their primary project template.
    // If primary project is comming from remote just use default template.
    else if ('project' in project && project.project && !_.get(req, 'body.settings.remoteStage', false)) {
      if (req.body.hasOwnProperty('copyFromProject') && req.body.copyFromProject === 'empty') {
        return importTemplate(_.cloneDeep(formio.templates['default']));
      }

      let projectId = project.project;

      if (req.body.hasOwnProperty('copyFromProject') && req.body.copyFromProject !== formio.util.idToString(project.project)) {
        projectId = formio.util.idToBson(req.body.copyFromProject);
      }

      formio.cache.loadProject(req, projectId, function(err, primaryProject) {
        formio.template.export({
          projectId: projectId,
          access: primaryProject.access ? primaryProject.access : [],
        }, function(err, template) {
          if (err) {
            // If something went wrong, just import the default template instead.
            return importTemplate(_.cloneDeep(formio.templates[defaultTemplateName]));
          }
          return importTemplate(template);
        });
      });
    }
    // Check for template that is already provided.
    else if ((typeof template === 'string') && formio.templates.hasOwnProperty(template)) {
      const templateObj = _.cloneDeep(formio.templates[template]);
      // Import the template.
      return importTemplate(templateObj);
    }
    else {
      // Unknown template.
      return res.status(400).send('Unknown template.');
    }
  };
};
