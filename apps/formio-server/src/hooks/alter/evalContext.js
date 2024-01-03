/* eslint-disable max-depth */
'use strict';
const {VM} = require('vm2');
const moment = require('moment');
const _ = require('lodash');
module.exports = app => (context, form) => {
  if (form && form.module) {
    if (typeof form.module === 'string') {
      try {
        let vm = new VM({
          timeout: 250,
          sandbox: {
            formModule: null,
            form,
          },
          fixAsync: true,
          eval: false,
        });

        vm.freeze(moment, 'moment');
        vm.freeze(_, '_');

        const formModule = vm.run(`formModule = ${form.module}`);
        if (formModule) {
          form.module = formModule;
        }

        vm = null;
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
