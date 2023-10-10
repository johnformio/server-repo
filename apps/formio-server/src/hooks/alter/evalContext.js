/* eslint-disable max-depth */
'use strict';
const vmUtil = require('vm-utils');
const _ = require('lodash');
module.exports = app => (context, form) => {
  if (form && form.module) {
    if (typeof form.module === 'string') {
      try {
        const isolate = vmUtil.getIsolate();
        const context = isolate.createContextSync();

        // Transfers function in the way it will be owned by sandbox isolate
        vmUtil.transferFnSync('serialize', serialize, context);

        const formModule = context.evalSync(`serialize(${form.module})`, {
          timeout: 250,
          copy: true
        });

        if (formModule) {
          form.module = deserialize(formModule);
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

// Applies callback to each property recursivly
// But not traversing serialized functions which have fn and source properties
function mapValuesDeep(v, callback) {
  return _.isObject(v) && _.intersection(Object.keys(v), ['fn', 'source']).length === 0
    ? _.mapValues(v, v => mapValuesDeep(v, callback))
    : callback(v);
}

// Deeply replaces each function in object
// With an object like { fn: true, source 'some function code'}
// It's needed because when function is created inside sandbox
// It's not possible to easily get it back to parent environment
function serialize(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof value === 'function') {
      return {
        fn: true,
        source: value.toString()
      };
    }
    return value;
  }));
}

// The opposite of `serialize` function
// Replaces all serialized functions with actuall functions
// Wrapped in IIFE
function deserialize(obj) {
  return mapValuesDeep(obj,
    (value) => {
      if (value.fn) {
        return eval(`(...args) => (${value.source})(...args)`);
      }
      return value;
    }
  );
}
