'use strict';

const _ = require('lodash');
const FormRevision = require('../../revisions/FormRevision');
const SubmissionRevision = require('../../revisions/SubmissionRevision');
const addFormDefaults = require('../../util/addFormDefaults');

module.exports = app => routes => {
  const loadFormAlter = require('../../hooks/alter/loadForm')(app).alter;
  const formRevision = new FormRevision(app);

  const getRequestUser = (req) => {
    const user = req.user || (req.adminKey ? {data: {name: 'admin'}} : null);
    return user;
  };

  routes.hooks.put = {
    async before(req, res, item, next) {
      app.formio.formio.util.markModifiedParameters(item, ['components', 'properties']);
      const form = await app.formio.formio.cache.loadForm(req, null, req.params.formId);
      if (formRevision.shouldCreateNewRevision(req, item, form)) {
        formRevision.incrementVersion(item);
      }
      next();
    },
    async after(req, res, item, next) {
        const form = await app.formio.formio.cache.loadForm(req, null, req.params.formId);
        if (formRevision.shouldCreateNewRevision(req, item, form)) {
          return formRevision.createVersion(item, getRequestUser(req), req.body._vnote, async (err, revision) => {
            if (err) {
              return next(err);
            }
              if (revision) {
                try {
                  await app.formio.formio.mongoose.models.formrevision.updateOne({
                    _id: revision._id
                  },
                  {$set: {
                    revisionId: revision._id,
                    }
                  });
                  return next();
                }
                catch (err) {
                  return next(err);
                }
              }
          });
        }
        if (req.body.submissionRevisions !== form.submissionRevisions && req.body.submissionRevisions === 'true') {
          const submissionRevision = new SubmissionRevision(app, req.submissionModel || null);
          await submissionRevision.updateRevisionsSet(form._id, req.user);
          return next();
        }
        next();
    }
  };

  routes.hooks.patch = {
    async before(req, res, item, next) {
      app.formio.formio.util.markModifiedParameters(item, ['components', 'properties']);
      const form = await app.formio.formio.cache.loadForm(req, null, req.params.formId);
      if (formRevision.shouldCreateNewRevision(req, item, form)) {
        formRevision.incrementVersion(item);
      }
      return next();
    },
    async after(req, res, item, next) {
        const form = await app.formio.formio.cache.loadForm(req, null, req.params.formId);
        if (formRevision.shouldCreateNewRevision(req, item, form)) {
          return formRevision.createVersion(item, getRequestUser(req), '', async (err, revision) => {
            if (err) {
              return next(err);
            }
              if (revision) {
                try {
                  await app.formio.formio.mongoose.models.formrevision.updateOne({
                    _id: revision._id
                  },
                  {$set: {
                    revisionId: revision._id,
                  }});
                  return next();
                }
                catch (err) {
                  return next(err);
                }
              }
          });
        }
        next();
    }
  };

  routes.hooks.post = {
    after(req, res, item, next) {
      if (
        item.revisions &&
        formRevision.revisionsAllowed(req)
      ) {
        return formRevision.createVersion(item, getRequestUser(req), req.body._vnote, async (err, revision) => {
          if (err) {
            return next(err);
          }
            if (revision) {
              try {
                await app.formio.formio.mongoose.models.formrevision.updateOne({
                  _id: revision._id
                },
                {$set: {
                  revisionId: revision._id,
                }});
                return next();
              }
              catch (err) {
                return next(err);
              }
            }
        });
      }
      return next();
    }
  };

  // Setup a form for separate collection.
  routes.before.unshift(require('../../middleware/validateSacPackageAndApplySubmissionCollection')(app));

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
      !formRevision.revisionsAllowed(req) &&
      req.url.endsWith('/draft')
    ) {
      if (!formRevision.checkRevisionPlan(req.primaryProject.plan)) {
        return res.status(402).send('Payment Required. Project must be on an Enterprise plan.');
      }
      else {
        return res.status(403).send('Form Revisions are not a part of your license.');
      }
    }
    next();
  });

  routes.before.push(async (req, res, next) => {
    if (req.method !== 'POST') {
      return next();
    }

    try {
      const project = await app.formio.formio.cache.loadCurrentProject(req);
      if (!project) {
        return next();
      }

      addFormDefaults(req.body, project.formDefaults);

      return next();
    }
    catch (err) {
      return next();
    }
  });

  routes.before.unshift(require('../../middleware/projectProtectAccess')(app.formio.formio));
  routes.before.unshift(require('../../middleware/formConflictHandler')(app.formio.formio));
  routes.after.push(require('../../middleware/projectModified')(app.formio.formio));

  /**
   * Ensure primary project is loaded. May fail without Redis otherwise.
   */
  routes.before.unshift(async (req, res, next) => {
    if (req.primaryProject) {
      return next();
    }

    try {
      const project = await app.formio.formio.cache.loadCurrentProject(req);
      if (!project) {
        return next();
      }

      addFormDefaults(req.body, project.formDefaults);

      return next();
    }
    catch (err) {
      return next();
    }
  });

  return routes;
};
