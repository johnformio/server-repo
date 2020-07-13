'use strict';

/* eslint-disable no-console */

const _ = require('lodash');
const {utilization, cachedUtilization, getProjectContext, getLicenseKey} = require('../util/utilization');

function middleware(formio) {
  return async (req, res, next) => {
    // Don't put default in function definition as it breaks express.
    if (!next) {
      next = () => {};
    }

    // Bypass the main formio project that hosts the licenses.
    if (_.get(req, 'currentProject.name') === 'formio' && process.env.FORMIO_HOSTED) {
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
    let form = {};

    if (req.formId) {
      form = await new Promise((resolve, reject) => {
        formio.cache.loadCurrentForm(req, (err, form) => {
          if (err) {
            return resolve();
          }
          return resolve(form);
        });
      });
    }

    try {
      switch (endpoint) {
        case 'GET /current':
          break;

        //           d8                                     88
        //         ,8P'                                     ""                            ,d
        //        d8"                                                                     88
        //      ,8P'  8b,dPPYba,   8b,dPPYba,   ,adPPYba,   88   ,adPPYba,   ,adPPYba,  MM88MMM
        //     d8"    88P'    "8a  88P'   "Y8  a8"     "8a  88  a8P_____88  a8"     ""    88
        //   ,8P'     88       d8  88          8b       d8  88  8PP"""""""  8b            88
        //  d8"       88b,   ,a8"  88          "8a,   ,a8"  88  "8b,   ,aa  "8a,   ,aa    88,
        // 8P'        88`YbbdP"'   88           `"YbbdP"'   88   `"Ybbd8"'   `"Ybbd8"'    "Y888
        //            88                                   ,88
        //            88                                 888P"

        case 'GET /project':
          if (
            res.resource && res.resource.item && Array.isArray(res.resource.item) &&
            req.query.project
          ) {
            await Promise.all(res.resource.item.map(async (project) => {
              if (project.type === 'stage') {
                // Load primary project
                try {
                  await new Promise((resolve, reject) => {
                    req.projectId = project.project;
                    formio.cache.loadPrimaryProject(req, (err, primaryProject) => {
                      if (err) {
                        return reject(err);
                      }
                      req.primaryProject = primaryProject;
                      return resolve(primaryProject);
                    });
                  });

                  const result = await utilization({
                    type: 'stage',
                    projectId: project.project.toString(),
                    tenantId: 'none',
                    stageId: project._id.toString(),
                    title: project.title,
                    name: project.name,
                    remote: !!project.remote,
                    projectType: project.type,
                    licenseKey: getLicenseKey(req),
                  }, '');
                  project.authoring = !result.live;
                }
                catch (err) {
                  project.disabled = true;
                }
              }
            }));
          }
          break;
        case 'GET /project/:projectId':
          try {
            const result = await utilization({
              ...getProjectContext(req),
              licenseKey: getLicenseKey(req),
            }, '', {terms: 1, keys: 1});
            let formManagerEnabled = false;
            let accessibilityEnabled = false;
            try {
              await utilization({
                ...getProjectContext(req),
                licenseKey: getLicenseKey(req),
                type: 'formManager'
              });
              formManagerEnabled = true;
            }
            catch (err) {
              formManagerEnabled = err.message;
            }
            try {
              await utilization({
                ...getProjectContext(req),
                licenseKey: getLicenseKey(req),
                type: 'Accessibility'
              });
              accessibilityEnabled = true;
            }
            catch (err) {
              accessibilityEnabled = err.message;
            }
            res.resource.item.apiCalls = {
              limit: result.terms,
              used: result.used,
              licenseId: result.licenseId,
              formManager: formManagerEnabled,
              accessibility: accessibilityEnabled,
              tenant: result.keys.hasOwnProperty(result.licenseKey) && result.keys[result.licenseKey].scope.includes('tenant'),
            };
          }
          catch (err) {
            res.resource.item.disabled = err.error;
          }
          break;

        // Require a license utilization when creating a project
        case 'POST /project':
          if (req.primaryProject && req.primaryProject.name === 'formio' && !process.env.FORMIO_HOSTED) {
            throw new Error('Cannot create stages or tenants in formio project. Please create a new project.');
          }
          if (!process.env.FORMIO_HOSTED) {
            await utilization({
              ...getProjectContext(req),
              licenseKey: getLicenseKey(req),
            });
          }
          break;

        // Allow projects to be updated so that a new license key can be added.
        case 'PUT /project/:projectId':
          try {
            const result = await utilization({
              ...getProjectContext(req),
              licenseKey: getLicenseKey(req),
            });
            if (res.resource && res.resource.item) {
              res.resource.item.apiCalls = {
                limit: result.terms,
                used: result.used,
                licenseId: result.licenseId,
              };
            }
          }
          catch (err) {
            if (res.resource && res.resource.item) {
              res.resource.item.disabled = err.error;
            }
          }
          break;

        // Disable project utilization when deleting a project
        case 'DELETE /project/:projectId':
          await utilization({
            ...getProjectContext(req),
            licenseKey: getLicenseKey(req),
          }, '/disable');
          break;

        case 'GET /project/:projectId/manage':
          await utilization({
            ...getProjectContext(req),
            licenseKey: getLicenseKey(req),
            type: 'formManager'
          });
          break;

        case 'POST /project/:projectId/import':
          if (_.get(req, 'currentProject.name') === 'formio' && !process.env.FORMIO_HOSTED) {
            throw new Error('Cannot import to formio project. Please create a new project for your forms.');
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
            throw new Error('Cannot add forms to formio project. Please create a new project for your forms.');
          }

          await utilization({
            type: 'form',
            formId: 'new',
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        // Require a formRequest utilization when grabbing a form
        case 'GET /form/:formId':
        case 'GET /form/:formId/draft':
          await cachedUtilization(`project:${req.projectId}:form:${req.formId}:formRequest`, {
            type: 'formRequest',
            formId: req.formId,
            title: form.title,
            name: form.name,
            path: form.path,
            formType: form.type,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        // Require a form utilization when updating a form
        case 'PUT /form/:formId':
        case 'PUT /form/:formId/draft':
        case 'PATCH /form/:formId':
          await utilization({
            type: 'form',
            formId: req.formId,
            title: form.title,
            name: form.name,
            path: form.path,
            formType: form.type,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        // Disable form utilization when deleting a form.
        case 'DELETE /form/:formId':
          if (_.get(req, 'currentProject.name') === 'formio' && !process.env.FORMIO_HOSTED) {
            throw new Error('Cannot delete forms to formio project.');
          }
          await utilization({
            type: 'form',
            formId: req.formId,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          }, '/disable');
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
          await cachedUtilization(`project:${req.projectId}:form:${req.formId}:submissionRequest`, {
            type: 'submissionRequest',
            submissionId: 'index',
            formId: req.formId,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        case 'POST /form/:formId/submission':
          await cachedUtilization(`project:${req.projectId}:form:${req.formId}:submissionRequest`, {
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
          await cachedUtilization(`project:${req.projectId}:form:${req.formId}:submissionRequest`,{
            type: 'submissionRequest',
            submissionId: req.params.submissionId,
            formId: req.formId,
            projectId: req.projectId,
            licenseKey: getLicenseKey(req),
          });
          break;

        default:
          console.log(`License utilization logic UNDEFINED for ${endpoint}`);
          throw new Error(`License utilization logic UNDEFINED for ${endpoint}`);
          // break
      }

      return next();
    }
    catch (e) {
      return res.status(e.statusCode || 400).send(
        e.name === 'StatusCodeError' ? `[${e.statusCode}] ${e.error}` : e.message
      );
    }
  };
}

module.exports = {
  middleware,
};
