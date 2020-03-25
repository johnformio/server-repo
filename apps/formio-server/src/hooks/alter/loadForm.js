'use strict';
const _ = require('lodash');
module.exports = app => {
  const loadFormAlter = {
    alter: (project, form) => {
      // Add form configs from public configs.
      if (_.get(project, 'settings.addConfigToForms', false)) {
        form.config = project.config;
      }

      // Add form modules.
      const formModule = _.get(project, 'settings.formModule');
      if (formModule) {
        form.module = formModule;
      }

      // Add recaptcha site keys.
      if (_.get(form, 'settings.recaptcha.isEnabled')) {
        _.set(form, 'settings.recaptcha.siteKey', _.get(project, 'settings.recaptcha.siteKey'));
      }
      return form;
    },
    hook: (form, req, next) => {
      if (!form || !form.project) {
        return next(null, form);
      }
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
