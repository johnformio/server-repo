'use strict';

const _ = require('lodash');

module.exports = app => routes => {
  const incrementVersion = function(item) {
    item.set('_vid', item.get('_vid') + 1);
  };

  const createVersion = function(item, user, note) {
    var body = item.toObject();
    body._rid = body._id;
    body._vuser = user.data.name;
    body._vnote = note;
    delete body._id;
    app.formio.formio.mongoose.models.formrevision.create(body);
  };

  const revisionPlans = ['trial', 'commercial'];

  routes.hooks.put = {
    before: function(req, res, item, next) {
      if (item.components) {
        item.markModified('components');
      }
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          (
            item.revisions && !form.revisions
          ) ||
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
    after: function(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          (
            item.revisions && !form.revisions
          ) ||
          (
            item.revisions &&
            revisionPlans.includes(req.primaryProject.plan) &&
            !_.isEqual(form.components, req.body.components)
          )
        ) {
          createVersion(item, req.user, req.body._vnote);
        }
        next();
      });
    }
  };

  routes.hooks.patch = {
    before: function(req, res, item, next) {
      if (item.components) {
        item.markModified('components');
      }
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          (
            item.revisions && !form.revisions
          ) ||
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
    after: function(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (
          (
            item.revisions && !form.revisions
          ) ||
          (
            item.revisions &&
            revisionPlans.includes(req.primaryProject.plan) &&
            !_.isEqual(form.components, req.body.components)
          )
        ) {
          createVersion(item, req.user);
        }
        next();
      });
    }
  };

  routes.hooks.post = {
    after: function(req, res, item, next) {
      if (
        item.revisions &&
        revisionPlans.includes(req.primaryProject.plan)
      ) {
        createVersion(item, req.user, req.body._vnote);
      }
      next();
    }
  };

  routes.before.unshift((req, res, next) => {
    // Remove _vid from any updates so it is set automatically.
    if (['PUT', 'PATCH', 'POST'].includes(req.method)) {
      req.body = _.omit(req.body, ['_vid']);
    }
    next();
  });

  routes.before.unshift(require('../../middleware/projectProtectAccess')(app.formio.formio));

  return routes;
};
