'use strict';

const _ = require('lodash');
const util = require('../../util/util');

module.exports = app => routes => {
  const loadFormAlter = require('../../hooks/alter/loadForm')(app).alter;
  const incrementVersion = function(item) {
    item.set('_vid', item.get('_vid') + 1);
  };

  const createVersion = function(item, user, note, done) {
    const formRevision = app.formio.formio.mongoose.models.formrevision;

    const body = item.toObject();
    body._rid = body._id;
    body._vuser = user ? (user.data ? user.data.name : user._id) : '';
    body._vnote = note || '';
    delete body._id;
    delete body.__v;

    formRevision.findOne({
      _rid: body._rid,
      _vid: 'draft'
    }).exec((err, result) => {
      if (err) {
        return done(err);
      }
      // If a draft exists, overwrite it.
      if (result) {
        result.set(body);
        return result.save(done);
      }
      // Otherwise create a new entry.
      formRevision.create(body, done);
    });
  };

  const revisionPlans = ['trial', 'commercial'];

  routes.hooks.put = {
    before(req, res, item, next) {
      if (item.components) {
        item.markModified('components');
      }
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          req.isDraft ||
          item.revisions && !form.revisions ||
          (
            item.revisions &&
            revisionPlans.includes(req.primaryProject.plan) &&
            !_.isEqual(form.components, req.body.components)
          )
        ) {
          incrementVersion(item);
        }
        next();
      });
    },
    after(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          req.isDraft ||
          item.revisions && !form.revisions ||
          (
            item.revisions &&
            revisionPlans.includes(req.primaryProject.plan) &&
            !_.isEqual(form.components, req.body.components)
          )
        ) {
          return createVersion(item, req.user, req.body._vnote, next);
        }
        next();
      });
    }
  };

  routes.hooks.patch = {
    before(req, res, item, next) {
      if (item.components) {
        item.markModified('components');
      }
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          req.isDraft ||
          item.revisions && !form.revisions ||
          (
            item.revisions &&
            revisionPlans.includes(req.primaryProject.plan) &&
            !_.isEqual(form.components, req.body.components)
          )
        ) {
          incrementVersion(item);
        }
        return next();
      });
    },
    after(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          req.isDraft ||
          item.revisions && !form.revisions ||
          (
            item.revisions &&
            revisionPlans.includes(req.primaryProject.plan) &&
            !_.isEqual(form.components, req.body.components)
          )
        ) {
          return createVersion(item, req.user, '', next);
        }
        next();
      });
    }
  };

  routes.hooks.post = {
    after(req, res, item, next) {
      if (
        item.revisions &&
        revisionPlans.includes(req.primaryProject.plan)
      ) {
        return createVersion(item, req.user, req.body._vnote, next);
      }
      next();
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
        return next();
      }

      // Set the indexes.
      app.formio.formio.util.eachComponent(req.body.components, (component, path) => {
        if (component.dbIndex) {
          const index = {};
          index[`data.${path}`] = 1;
          submissionModel.collection.createIndex(index, {
            background: true
          });
        }
      });

      return next();
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
      !revisionPlans.includes(req.primaryProject.plan) &&
      req.url.endsWith('/draft')
    ) {
      return res.status(402).send('Payment Required. Project must be on an Enterprise plan.');
    }
    next();
  });

  routes.before.unshift(require('../../middleware/projectProtectAccess')(app.formio.formio));
  routes.before.unshift(require('../../middleware/formRevisionUpdate')(app.formio.formio));
  routes.before.unshift(require('../../middleware/formConflictHandler')(app.formio.formio));
  routes.after.push(require('../../middleware/projectModified')(app.formio.formio));

  /**
   * Ensure primary project is loaded. May fail without Redis otherwise.
   */
  routes.before.unshift((req, res, next) => {
    if (req.primaryProject) {
      return next();
    }
    app.formio.formio.cache.loadPrimaryProject(req, (err, project) => {
      if (err) {
        /* eslint-disable no-console */
        console.error(err);
        /* eslint-enable no-console */
        return next();
      }
      req.primaryProject = project.toObject();
      next();
    });
  });

  return routes;
};
