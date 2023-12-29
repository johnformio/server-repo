
'use strict';
const config = require('../../config');
const reportingUITemplate = require('@formio/reporting/reportConfigTemplate.json');
const _ = require('lodash');

module.exports = function(app) {
    if (!config.formio.hosted && _.get(app, 'license.terms.options.reporting', false)) {
        const defaultTemplate = _.get(app, 'formio.formio.templates.default', null);
        if (defaultTemplate) {
            _.set(app, 'formio.templates.default', _.merge(defaultTemplate, _.cloneDeep(reportingUITemplate)));
        }
    }
};
