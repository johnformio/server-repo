'use strict';

/* eslint-disable no-console */
/* eslint-disable max-depth */
/* eslint-disable no-case-declarations */

const _ = require('lodash');
const {
  utilization,
  utilizationSync,
  getProjectContext,
  getLicenseKey,
  checkLastUtilizationTime,
  setLicensePlan,
  remoteUtilization
} = require('../util/utilization');

function middleware(app) {
  const formio = app.formio.formio;
  return async (req, res, next) => {
    const isHosted = process.env.FORMIO_HOSTED && process.env.FORMIO_HOSTED !== 'false';
    // Don't put default in function definition as it breaks express.
    if (!next) {
      next = () => {};
    }

    // Bypass the main formio project that hosts the licenses.
    if (_.get(req, 'currentProject.name') === 'formio' && isHosted) {
      return next();
    }

    if (req.skipLicense) {
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

    // Skip license utilization checks for remote non get project.
    if (remote && endpoint !== 'GET /project/:projectId' && endpoint !== 'POST /project') {
      return next();
    }

    if (isHosted && endpoint.indexOf(' /project') === -1) {
      return next();
    }

    let currentForm = {};
    if (req.formId) {
      currentForm = await new Promise((resolve, reject) => {
        formio.cache.loadCurrentForm(req, (err, form) => {
          if (err) {
            return resolve();
          }
          return resolve(form);
        });
      });
    }

    let result = null;

    try {
      switch (endpoint) {
        case 'GET /current':
          break;
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
            formManagerEnabled = app.license.terms.scopes.includes('formManager');
            accessibilityEnabled = app.license.terms.options.sac;
            tenantEnabled = app.license.terms.scopes.includes('tenant');
          }
          else {
            result = utilization(`project:${req.projectId}`, {
              ...getProjectContext(req),
              licenseKey: getLicenseKey(req),
            });
            if (result) {
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

            const managerResult = utilization(`project:${req.projectId}:formManager`, {
              ...getProjectContext(req),
              licenseKey: getLicenseKey(req),
              type: 'formManager'
            });
            formManagerEnabled = (managerResult && managerResult.error) ? managerResult.error.message : true;

            const accResult = utilization(`project:${req.projectId}:accessibility`, {
              ...getProjectContext(req),
              licenseKey: getLicenseKey(req),
              type: 'Accessibility'
            });
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
          if (_.get(req, 'primaryProject.name') === 'formio' && !process.env.FORMIO_HOSTED) {
            res.status(400).send('Cannot create stages or tenants in formio project. Please create a new project.');
            break;
          }

          if (remote) {
            result = req.body.project ? await remoteUtilization(app) : await remoteUtilization(app, {strict: true});
          }
          else {
            result = await utilizationSync(`project:create`, {
              ...getProjectContext(req, true),
              licenseKey: getLicenseKey(req),
            });
          }

          break;

        // Allow projects to be updated so that a new license key can be added.
        case 'PUT /project/:projectId':
          // Don't check utilization for formio project.
          if (_.get(req, 'primaryProject.name') === 'formio') {
            break;
          }
          // Only block if the plan changes.
          if (isHosted && req.body.plan && (req.body.plan !== req.currentProject.plan)) {
            const licenseKey = getLicenseKey(req);
            await setLicensePlan(formio, licenseKey, req.body.plan);
            result = await utilizationSync(`project:${req.projectId}`, {
              ...getProjectContext(req),
              licenseKey,
            });
          }
          else {
              result = utilization(`project:${req.projectId}`, {
                ...getProjectContext(req),
                licenseKey: getLicenseKey(req),
              });
          }
          if (result) {
            if (res.resource && res.resource.item) {
              if (result.error) {
                res.resource.item.disabled = result.error.message;
              }
              else {
                res.resource.item.apiCalls = {
                  limit: result.terms,
                  used: result.used,
                  licenseId: result.licenseId,
                };
              }
            }
          }
          break;

        // Disable project utilization when deleting a project
        case 'DELETE /project/:projectId':
          // Don't check utilization for formio project.
          if (_.get(req, 'primaryProject.name') === 'formio') {
            res.status(400).send('Cannot delete the formio project.');
            break;
          }
          utilization(`project:${req.projectId}`, {
            ...getProjectContext(req),
            licenseKey: getLicenseKey(req),
          }, '/delete', {terms: 1}, true);
          break;

        case 'GET /project/:projectId/manage':
          utilization(`project:${req.projectId}:formManager`, {
            ...getProjectContext(req),
            licenseKey: getLicenseKey(req),
            type: 'formManager'
          });
          break;

        case 'POST /project/:projectId/import':
          if (_.get(req, 'primaryProject.name') === 'formio' && !process.env.FORMIO_HOSTED) {
            res.status(400).send('Cannot import to formio project. Please create a new project for your forms.');
          }
          break;

        //           d8   ad88
        //         ,8P'  d8"
        //        d8"    88
        //      ,8P'   MM88MMM  ,adPPYba,   8b,dPPYba,  88,dPYba,,adPYba,
        //     d8"       88    a8"     "8a  88P'   "Y8  88P'   "88"    "8a
        //   ,8P'        88    8b       d8  88          88      88      88
        //  d8"          88    "8a,   ,a8"  88          88      88      88
        // 8P'           88     `"YbbdP"'   88          88      88      88

        // Don't require a utilization when indexing forms
        case 'GET /form':
          break;

        // Require a form utilization when creating a form
        case 'POST /form':
          if (_.get(req, 'currentProject.name') === 'formio' && !process.env.FORMIO_HOSTED) {
            res.status(400).send('Cannot add forms to formio project. Please create a new project for your forms.');
            break;
          }

            utilization(`project:${req.projectId}:formCreate`, {
              type: 'form',
              formId: 'new',
              projectId: req.projectId,
              licenseKey: getLicenseKey(req),
            });

          break;

        // Require a formRequest utilization when grabbing a form
        case 'GET /form/:formId':
        case 'GET /form/:formId/draft':
          utilization(`project:${req.projectId}:form:${req.formId}:formRequest`, {
            type: 'formRequest',
            formId: req.formId,
            title: currentForm.title,
            name: currentForm.name,
            path: currentForm.path,
            formType: currentForm.type,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        // Require a form utilization when updating a form
        case 'PUT /form/:formId':
        case 'PUT /form/:formId/draft':
        case 'PATCH /form/:formId':
            utilization(`project:${req.projectId}:form:${req.formId}:formUpdate`, {
              type: 'form',
              formId: req.formId,
              title: currentForm.title,
              name: currentForm.name,
              path: currentForm.path,
              formType: currentForm.type,
              projectId: req.projectId,
              licenseKey: getLicenseKey(req),
            });
          break;

        // Disable form utilization when deleting a form.
        case 'DELETE /form/:formId':
          if (_.get(req, 'currentProject.name') === 'formio' && !process.env.FORMIO_HOSTED) {
            res.status(400).send('Cannot delete forms to formio project.');
            break;
          }
          utilization(`project:${req.projectId}:form:${req.formId}`, {
            type: 'form',
            formId: req.formId,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          }, '/delete');
          break;

        //           d8                       88                               88                        88
        //         ,8P'                       88                               ""                        ""
        //        d8"                         88
        //      ,8P'  ,adPPYba,  88       88  88,dPPYba,   88,dPYba,,adPYba,   88  ,adPPYba,  ,adPPYba,  88   ,adPPYba,   8b,dPPYba,
        //     d8"    I8[    ""  88       88  88P'    "8a  88P'   "88"    "8a  88  I8[    ""  I8[    ""  88  a8"     "8a  88P'   `"8a
        //   ,8P'      `"Y8ba,   88       88  88       d8  88      88      88  88   `"Y8ba,    `"Y8ba,   88  8b       d8  88       88
        //  d8"       aa    ]8I  "8a,   ,a88  88b,   ,a8"  88      88      88  88  aa    ]8I  aa    ]8I  88  "8a,   ,a8"  88       88
        // 8P'        `"YbbdP"'   `"YbbdP'Y8  8Y"Ybbd8"'   88      88      88  88  `"YbbdP"'  `"YbbdP"'  88   `"YbbdP"'   88       88

        case 'GET /form/:formId/submission':
          utilization(`project:${req.projectId}:form:${req.formId}:submissionRequest`, {
            type: 'submissionRequest',
            submissionId: 'index',
            formId: req.formId,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        case 'POST /form/:formId/submission':
          utilization(`project:${req.projectId}:form:${req.formId}:submissionRequest`, {
            type: 'submissionRequest',
            submissionId: 'new',
            formId: req.formId,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        // Require a submissionRequest utilization when getting or updating a submission
        case 'PATCH /form/:formId/submission/:submissionId':
        case 'PUT /form/:formId/submission/:submissionId':
        case 'GET /form/:formId/submission/:submissionId':
          utilization(`project:${req.projectId}:form:${req.formId}:submissionRequest`, {
            type: 'submissionRequest',
            submissionId: req.params.submissionId,
            formId: req.formId,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        default:
          break;
      }

      if (result && result.error) {
        if (checkLastUtilizationTime(req)) {
          return next();
        }
        return res.status(400).send(result.error.message);
      }
      return next();
    }
    catch (e) {
      if (checkLastUtilizationTime(req)) {
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
