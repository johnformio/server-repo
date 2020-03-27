'use strict';
const vm = require('vm');
const moment = require('moment');
const _ = require('lodash');
module.exports = app => (context, form) => {
  if (form && form.module) {
    if (typeof form.module === 'string') {
      try {
        const formContext = {
          moment,
          _,
          form,
          formModule: null
        };
        const sandbox = vm.createContext(formContext);
        const script = new vm.Script(`formModule = ${form.module}`);
        script.runInContext(sandbox, {
          timeout: 250
        });
        if (formContext.formModule) {
          form.module = formContext.formModule;
        }
      }
      catch (err) {
        // eslint-disable-next-line no-console
        console.warn(err);
      }
    }
    if (
      form.module.options &&
      form.module.options.form &&
      form.module.options.form.evalContext
    ) {
      // Add the module eval context to the execution script.
      context = Object.assign(context, form.module.options.form.evalContext);
    }
  }
  return context;
};
