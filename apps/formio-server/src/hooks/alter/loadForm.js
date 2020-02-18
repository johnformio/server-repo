'use strict';
const _ = require('lodash');
module.exports = app => {
  const loadFormAlter = {
    alter: (project, form) => {
      if (_.get(project, 'settings.addConfigToForms', false)) {
        form.config = project.config;
      }
      const formModule = _.get(project, 'settings.formModule');
      if (formModule) {
        form.module = formModule;
      }
      return form;
    },
    hook: (form, req, next) => {
      app.formio.formio.cache.loadProject(req, form.project.toString(), (err, project) => {
        if (err) {
          return next(err);
        }
        return next(null, loadFormAlter.alter(project, form));
      });
    }
  };
  return loadFormAlter;
};
