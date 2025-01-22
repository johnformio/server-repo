'use strict';
const _ = require('lodash');

module.exports = function(form, formDefaults) {
  if (!form || !formDefaults || !_.isPlainObject(formDefaults)) {
      return;
  }

  Object.keys(formDefaults).forEach((key) => {
    const currentValue = form[key];
    const defaultValue = formDefaults[key];

    if (!currentValue && defaultValue) {
      form[key] = _.cloneDeep(defaultValue);
    }
    else if (_.includes(['access', 'submissionAccess'], key) && _.isArray(currentValue) && _.isArray(defaultValue)) {
      if (_.isEmpty(currentValue)) {
        form[key] = _.cloneDeep(defaultValue);
      }
      else {
        _.each(defaultValue, access => {
          if (!access || !access.roles) {
            return;
          }
          const currentAccess = _.find(currentValue, v => access.type === v.type);

          if (!currentAccess) {
            currentValue.push(_.cloneDeep(access));
          }
        });
      }
    }
    else if (_.includes(['settings'], key) && _.isPlainObject(currentValue) &&  _.isPlainObject(defaultValue)) {
      if (_.isEmpty(currentValue)) {
        form[key] = _.cloneDeep(defaultValue);
      }
      else {
        _.each(defaultValue, (v, prop) => {
          if (!currentValue[prop]) {
            currentValue[prop] = v;
          }
        });
      }
    }
  });
};
