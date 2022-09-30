'use strict';

const _ = require('lodash');
const config = require('../../config');
const {
  utilization,
  utilizationSync,
  getLicenseKey,
} = require('../util/utilization');
const getProjectContext = require('../util/getProjectContext');

function middleware(app) {
    return async (req, res, next) => {
        // Don't put default in function definition as it breaks express.

        if (config.formio.hosted) {
          return next();
        }

        // Bypass the main formio project that hosts the licenses.
        if (_.get(req, 'currentProject.name') === 'formio') {
          return next();
        }

        next();

        return await utilizationSync(app, `project:create`, {
            ...getProjectContext(req, false, res, true, app),
            licenseKey: getLicenseKey(req),
        });
    };
}

module.exports = {
    middleware
};
