'use strict';

/* eslint-disable no-console */
/* eslint-disable max-depth */
/* eslint-disable no-case-declarations */

const _ = require('lodash');
const debug = require('debug')('formio:licenseUtilization');
const {
  utilization,
  utilizationSync,
  getLicenseKey,
  checkLastUtilizationTime,
  remoteUtilization
} = require('../util/utilization');
const getProjectContext = require('../util/getProjectContext');
const config = require('../../config');

function middleware(app) {
  return async (req, res, next) => {
    // Don't put default in function definition as it breaks express.
    if (!next) {
      next = () => { };
    }

    // Bypass the main formio project that hosts the licenses.
    if (_.get(req, 'currentProject.name') === 'formio') {
      return next();
    }

    // Don't do utilization requests on child requests.
    if (req.childRequests && req.childRequests > 0) {
      return next();
    }

    // If an error is passed in, pass it along.
    // This is caused by the function being incorrectly called somewhere.
    if (typeof req === 'string' || req instanceof Error) {
      return res(req);
    }

    const endpoint = `${req.method} ${req.route.path}`;
    const remote = _.get(app, 'license.remote', false);
    let result = null;

    try {
      let projectContext;
      switch (endpoint) {
        case 'GET /project/:projectId':
          // Don't check utilization for formio project.
          if (_.get(req, 'primaryProject.name') === 'formio') {
            break;
          }
          let formManagerEnabled = false;
          let accessibilityEnabled = false;
          let tenantEnabled = false;
          let terms = app.license.terms;
          let used = {};
          let licenseId = 'remote';
          if (remote) {
            formManagerEnabled = _.get(app, 'license.terms.scopes', []).includes('formManager');
            accessibilityEnabled = _.get(app, 'license.terms.options.sac', false);
            tenantEnabled = _.get(app, 'license.terms.scopes', []).includes('tenant');
          }
          else {
            const requestBody = {
              ...getProjectContext(req),
              licenseKey: getLicenseKey(req),
            };

            const utilizationChecks = await Promise.all([
              utilizationSync(app, `project:${req.projectId}`, {...requestBody}, '', false),
              utilizationSync(app, `project:${req.projectId}:formManager`, {
                ...requestBody,
                type: 'formManager'
              }, '', false),
              utilizationSync(app, `project:${req.projectId}:accessibility`, {
                ...requestBody,
                type: 'Accessibility'
              }, '', false)
            ]);

            const [projectResult, managerResult, accResult] = utilizationChecks;

            if (projectResult) {
              result = projectResult;

              if (result.error) {
                res.resource.item.disabled = result.error.message;
              }
              else {
                terms = result.terms;
                used = result.used;
                licenseId = result.licenseId;
                tenantEnabled = result.keys && result.keys.hasOwnProperty(result.licenseKey) && result.keys[result.licenseKey].scope ? result.keys[result.licenseKey].scope.includes('tenant') : false;
              }
            }

            formManagerEnabled = (managerResult && managerResult.error) ? managerResult.error.message : true;
            accessibilityEnabled = accResult && accResult.error ? accResult.error.message : true;
          }

          res.resource.item.apiCalls = {
            limit: terms,
            used,
            licenseId,
            formManager: formManagerEnabled,
            accessibility: accessibilityEnabled,
            tenant: tenantEnabled,
          };
          break;

        // Require a license utilization when creating a project
        case 'POST /project':
          if (_.get(req, 'primaryProject.name') === 'formio') {
            res.status(400).send('Cannot create stages or tenants in formio project. Please create a new project.');
            break;
          }
          projectContext = getProjectContext(req, true);
          if (remote) {
            result = await remoteUtilization(app, projectContext);
          }
          else {
            result = await utilizationSync(app, `project:create`, {
              ...projectContext,
              licenseKey: getLicenseKey(req),
            });
          }

          break;

        // Allow projects to be updated so that a new license key can be added.
        case 'PUT /project/:projectId':
          if (_.get(req, 'primaryProject.name') === 'formio') {
            break;
          }
          projectContext = getProjectContext(req);
          if (remote) {
            result = await remoteUtilization(app, projectContext);
          }
          else {
            result = utilization(app, `project:${req.projectId}`, {
              ...projectContext,
              licenseKey: getLicenseKey(req),
            });
          }
          break;

        // Disable project utilization when deleting a project
        case 'DELETE /project/:projectId':
          if (_.get(req, 'primaryProject.name') === 'formio') {
            res.status(400).send('Cannot delete the formio project.');
            break;
          }
          if (remote) {
            return next();
          }
          utilization(app, `project:${req.projectId}`, {
            ...getProjectContext(req),
            licenseKey: getLicenseKey(req),
          }, '/delete', {terms: 1}, true);
          break;

        case 'GET /project/:projectId/manage':
          let fmEnabled = false;

          if (config.formio.hosted) {
            const fmForHostedResult = await utilizationSync(app, `project:${req.projectId}:formManager:hosted`, null, null, false, `${req.protocol}://${req.get(':authority') || req.get('host')}`);
            debug(`FM For Hosted Result: ${JSON.stringify(fmForHostedResult)}`);
            fmEnabled = !!(fmForHostedResult && fmForHostedResult.enabled);
          }
          else if (remote) {
            fmEnabled = _.get(app, 'license.terms.scopes', []).includes('formManager');
          }
          else {
            const fmResult = await utilizationSync(app, `project:${req.projectId}:formManager`, {
              ...getProjectContext(req, false, res),
              licenseKey: getLicenseKey(req),
              type: 'formManager'
            });

            if (fmResult) {
              fmEnabled = !fmResult.error;
            }
          }

          if (req.currentProject) {
            req.currentProject.formManagerEnabled = fmEnabled;
          }
          break;

        case 'POST /project/:projectId/import':
          if (_.get(req, 'primaryProject.name') === 'formio') {
            res.status(400).send('Cannot import to formio project. Please create a new project for your forms.');
          }
          break;
        default:
          break;
      }

      if (result && result.error) {
        if (checkLastUtilizationTime(req) && app.restrictMethods) {
          return next();
        }
        const status = result.error.statusCode ? result.error.statusCode : 400;
        return res.status(status).json(result.error.message);
      }
      return next();
    }
    catch (e) {
      if (checkLastUtilizationTime(req) && app.restrictMethods) {
        return next();
      }
      return res.status(e.statusCode || 400).send(
        e.name === 'StatusCodeError' ? `[${e.statusCode}] ${e.error}` : e.message
      );
    }
  };
}

module.exports = {
  middleware,
};
