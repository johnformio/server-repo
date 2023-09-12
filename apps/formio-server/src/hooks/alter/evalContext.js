/* eslint-disable max-depth */
'use strict';
const vmUtil = require('formio-workers/vmUtil');
const {Isolate} = require('formio-workers/vmUtil');
const moment = require('moment');
const _ = require('lodash');
module.exports = app => (context, form) => {
  if (form && form.module) {
    if (typeof form.module === 'string') {
      try {
        const isolate = new Isolate({memoryLimit: 8});
        const context = isolate.createContextSync();
        vmUtil.transferSync('formModule', null, context);
        vmUtil.transferSync('form', form, context);
        vmUtil.freezeSync('moment', moment, context);
        vmUtil.freezeSync('_', _, context);

        const formModule = context.evalSync(`formModule = ${form.module}`, {
          timeout: 250,
          copy: true
        });

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
