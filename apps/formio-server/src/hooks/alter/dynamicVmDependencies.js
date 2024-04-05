'use strict';
const _ = require('lodash');
const fs = require('fs');
const resolve = require('resolve/sync');

const reportingCode = [
  fs.readFileSync(resolve('@formio/reporting/build/reporting.vm.js'), 'utf8'),
  'utils.reporting = reporting.utils;util.reporting = reporting.utils;'
];

module.exports = (app) => {
  /**
   * Injects VM dependencies needed by the Enterprise Server into a dependencies array and returns it
   * @param {Object} form - The form object
   * @param {Array} deps - The dependencies array
   */
  return function(deps, form) {
    // only load reporting code if the reporting configurator is being used and we are licensed for it
    const hasReporting = _.get(app, 'license.terms.options.reporting', false);
    const isReportingForm = _.get(form, 'name') === 'reportingui' && _.get(form, 'path') === 'reportingui';
    if (hasReporting && isReportingForm) {
      return [...deps, ...reportingCode];
    }
    return deps;
  };
};
