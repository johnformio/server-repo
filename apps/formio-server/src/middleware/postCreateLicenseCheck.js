'use strict';

const _ = require('lodash');
const config = require('../../config');
const {
  utilizationSync,
  getLicenseKey,
} = require('../util/utilization');
const getProjectContext = require('../util/getProjectContext');

function middleware(app) {
    return async (req, res, next) => {
      try {
        // Don't put default in function definition as it breaks express.

        if (config.formio.hosted) {
          return next();
        }

        // Bypass the main formio project that hosts the licenses.
        if (_.get(req, 'currentProject.name') === 'formio') {
          return next();
        }

        const utilizationContext = {
          ...getProjectContext(req, false, res, true, app),
          licenseKey: getLicenseKey(req),
        };

        await utilizationSync(app, `project:create`, utilizationContext);

        const itemId = res.resource.item._id;
        if (itemId) {
          // need to set form manager status for newly created project
          await utilizationSync(app, `project:${itemId}:formManager`, {
            ...utilizationContext,
            type: 'formManager'
          });
        }
         return next();
      }
      catch (err) {
        return res.status(400).send(err.message);
      }
    };
}

module.exports = {
    middleware
};
