'use strict';
const {VM} = require('vm2');
const moment = require('moment');
const _ = require('lodash');
module.exports = app => (context, form) => {
  if (form && form.module) {
    if (typeof form.module === 'string') {
      try {
        const formModule = (new VM({
          timeout: 250,
          sandbox: {
            moment,
            _,
            form,
            formModule: null
          },
          fixAsync: true,
          eval: false,
        })).run(`formModule = ${form.module}`);
        if (formModule) {
          form.module = formModule;
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
