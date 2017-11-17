'use strict';

const _ = require('lodash');

module.exports = app => routes => {
  const incrementVersion = function(item) {
    item.set('_vid', item.get('_vid') + 1);
  };

  const createVersion = function(item, user, note, done) {
    const formRevision = app.formio.formio.mongoose.models.formrevision;

    var body = item.toObject();
    body._rid = body._id;
    body._vuser = user.data.name;
    body._vnote = note || '';
    delete body._id;
    delete body.__v;

    formRevision.findOne({
      _rid: body._rid,
      _vid: 'draft'
    }, (err, result) => {
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
    before: function(req, res, item, next) {
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
    after: function(req, res, item, next) {
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
    before: function(req, res, item, next) {
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
    after: function(req, res, item, next) {
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
    after: function(req, res, item, next) {
      if (
        item.revisions &&
        revisionPlans.includes(req.primaryProject.plan)
      ) {
        return createVersion(item, req.user, req.body._vnote, next);
      }
      next();
    }
  };

  routes.before.unshift((req, res, next) => {
    // Remove _vid from any updates so it is set automatically.
    if (['PUT', 'PATCH', 'POST'].includes(req.method)) {
      if (req.body.hasOwnProperty('_vid') && req.body._vid === 'draft') {
        req.isDraft = true;
      }
      req.body = _.omit(req.body, ['_vid']);
    }
    next();
  });

  routes.before.unshift(require('../../middleware/projectProtectAccess')(app.formio.formio));

  return routes;
};
