'use strict';
const _ = require('lodash');
const config = require("../../../config");
module.exports = app => {
  const loadFormAlter = {
    alter: (project, form) => {
      // Add form configs from public configs.
      if (_.get(project, 'settings.addConfigToForms', false)) {
        form.config = project.config;
      }

      const sanitizeConfigPath = 'settings.sanitizeConfig';
      const formGlobalSanitizeConfigPath = 'globalSettings.sanitizeConfig';
      if (!config.formio.hosted) {
        const formSanitizeConfig = _.get(form, sanitizeConfigPath);
        const globalSanitizeConfig = _.get(project, sanitizeConfigPath);
        // Add a global sanitize config to the form if it does not have its own
        if (!formSanitizeConfig && !_.isEmpty(globalSanitizeConfig)) {
          _.set(form, formGlobalSanitizeConfigPath, globalSanitizeConfig);
        }
      }
      else {
        // Not allow sanitize config for hosted env
        _.unset(form, sanitizeConfigPath);
        _.unset(form, formGlobalSanitizeConfigPath);
      }

      // Add form modules.
      const formModule = _.get(project, 'settings.formModule');
      if (formModule) {
        form.module = formModule;
      }

      const allowAllSubmissionData = _.get(project, 'settings.allowAllSubmissionData');
      if (allowAllSubmissionData) {
        form.allowAllSubmissionData = true;
      }

      // Add captcha site keys.
      if (_.get(form, 'settings.captcha.isEnabled')) {
        _.set(form, 'settings.recaptcha.siteKey', _.get(project, 'settings.recaptcha.siteKey'));
        _.set(form, 'settings.captcha.siteKey', _.get(project, 'settings.captcha.siteKey'));
      }

      // add project plan to form definition in hosted environments
      if (config.formio.hosted) {
        form.plan = project.plan;
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
