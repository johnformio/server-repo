'use strict';

const _ = require('lodash');
const util = require('../../util/util');
const {utilization, getLicenseKey} = require('../../util/utilization');
const FormRevision = require('../../revisions/FormRevision');
const SubmissionRevision = require('../../revisions/SubmissionRevision');

module.exports = app => routes => {
  const loadFormAlter = require('../../hooks/alter/loadForm')(app).alter;
  const formRevision = new FormRevision(app);

  const getRequestUser = (req) => {
    const user = req.user || (req.adminKey ? {data: {name: 'admin'}} : null);
    return user;
  };

  routes.hooks.put = {
    before(req, res, item, next) {
      app.formio.formio.util.markModifiedParameters(item, ['components', 'properties']);
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (formRevision.shouldCreateNewRevision(req, item, form)) {
          formRevision.incrementVersion(item);
        }
        next();
      });
    },
    after(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (formRevision.shouldCreateNewRevision(req, item, form)) {
          return formRevision.createVersion(item, getRequestUser(req), req.body._vnote, (err, revision) => {
            revision.revisionId = revision._id;
            revision.save(next);
          });
        }
        if (req.body.submissionRevisions !== form.submissionRevisions && req.body.submissionRevisions === 'true') {
          const submissionRevision = new SubmissionRevision(app);
          return submissionRevision.updateRevisionsSet(form._id, req.user, next);
        }
        next();
      });
    }
  };

  routes.hooks.patch = {
    before(req, res, item, next) {
      app.formio.formio.util.markModifiedParameters(item, ['components', 'properties']);
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (formRevision.shouldCreateNewRevision(req, item, form)) {
          formRevision.incrementVersion(item);
        }
        return next();
      });
    },
    after(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (formRevision.shouldCreateNewRevision(req, item, form)) {
          return formRevision.createVersion(item, getRequestUser(req), '', (err, revision) => {
            revision.revisionId = revision._id;
            revision.save(next);
          });
        }
        next();
      });
    }
  };

  routes.hooks.post = {
    after(req, res, item, next) {
      if (
        item.revisions &&
        formRevision.checkRevisionPlane(req.primaryProject.plan)
      ) {
        return formRevision.createVersion(item, getRequestUser(req), req.body._vnote, (err, revision) => {
          revision.revisionId = revision._id;
          revision.save(next);
        });
      }

      if (!item) {
        return next();
      }

      const result = utilization(`project:${item.project}:formCreate`, {
        type: 'form',
        formId: item._id,
        title: item.title,
        name: item.name,
        path: item.path,
        formType: item.type,
        projectId: item.project,
        licenseKey: getLicenseKey(req),
      });
      if (result && result.error) {
        return next(result.error.message);
      }
      return next();
    }
  };

  // Setup a form for separate collection.
  routes.before.unshift((req, res, next) => {
    if (
      (req.method !== 'POST' && req.method !== 'PUT') ||
      !req.body
    ) {
      return next();
    }

    // Get the submissionModel.
    util.getSubmissionModel(app.formio.formio, req, req.body, false, (err, submissionModel) => {
      if (err) {
        return next(err);
      }

      if (!submissionModel) {
        submissionModel = _.get(app.formio.formio, 'resources.submission.model');
        if (!submissionModel) {
          return next();
        }
      }

      const hasSacLicense = _.get(app, 'license.terms.options.sac', false);
      let isAllowed = true;

      if ( _.get(req, 'body.settings.collection', false) && !hasSacLicense) {
        isAllowed = false;
        return res.status(403).send('Security and compliance license is required to use Submissions Collection');
      }
      // Set the indexes.
      app.formio.formio.util.eachComponent(req.body.components, (component, path) => {
        if (component.dbIndex) {
          if (hasSacLicense) {
            const index = {};
            index[`data.${path}`] = 1;
            submissionModel.collection.createIndex(index, {
              background: true
            });
          }
          else {
            isAllowed = false;
          return res.status(403).send('Security and compliance license is required to use the index');
          }
        }

        if (component.encrypted && !hasSacLicense) {
          isAllowed = false;
          return res.status(403).send('Security and compliance license is required to use the encryption');
        }
      });

      if (isAllowed) {
        return next();
      }
    });
  });

  routes.before.unshift((req, res, next) => {
    // Remove _vid from any updates so it is set automatically.
    if (['PUT', 'PATCH', 'POST'].includes(req.method)) {
      if (req.body.hasOwnProperty('_vid') && req.body._vid === 'draft') {
        req.isDraft = true;
      }
      req.body = _.omit(req.body, ['_vid', 'config']);
    }
    next();
  });

  routes.after.push((req, res, next) => {
    if (['GET', 'INDEX'].includes(req.method)) {
      if (res.resource.item) {
        loadFormAlter(req.currentProject, res.resource.item);
      }
      if (res.resource.items) {
        _.map(res.resource.items, item => loadFormAlter(req.currentProject, item));
      }
    }
    next();
  });

  routes.before.unshift((req, res, next) => {
    // Don't allow editing drafts if not on enterprise plan.
    if (
      ['PUT'].includes(req.method) &&
      !formRevision.checkRevisionPlane(req.primaryProject.plan) &&
      req.url.endsWith('/draft')
    ) {
      return res.status(402).send('Payment Required. Project must be on an Enterprise plan.');
    }
    next();
  });

  routes.before.push((req, res, next) => {
    if (req.method !== 'POST') {
      return next();
    }

    app.formio.formio.cache.loadCurrentProject(req, (err, project) => {
      if (err || !project) {
        return next();
      }

      const formDefaults = project.formDefaults || {};
      Object.keys(formDefaults).forEach((key) => {
        if (!req.body[key] && formDefaults[key]) {
          req.body[key] = formDefaults[key];
        }
      });

      next();
    });
  });

  routes.before.unshift(require('../../middleware/projectProtectAccess')(app.formio.formio));
  routes.before.unshift(require('../../middleware/formConflictHandler')(app.formio.formio));
  routes.before.unshift(require('../../middleware/licenseUtilization').middleware(app));
  routes.after.push(require('../../middleware/projectModified')(app.formio.formio));

  /**
   * Ensure primary project is loaded. May fail without Redis otherwise.
   */
  routes.before.unshift((req, res, next) => {
    if (req.primaryProject) {
      return next();
    }

    app.formio.formio.cache.loadCurrentProject(req, (err, project) => {
      if (err || !project) {
        return next();
      }

      const formDefaults = project.formDefaults || {};
      Object.keys(formDefaults).forEach((key) => {
        if (!req.body[key] && formDefaults[key]) {
          req.body[key] = formDefaults[key];
        }
      });

      next();
    });
  });

  return routes;
};
