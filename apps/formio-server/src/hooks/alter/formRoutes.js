'use strict';

const _ = require('lodash');

module.exports = app => routes => {
  const incrementVersion = function(item) {
    item.set('_vid', item.get('_vid') + 1);
  };

  const createVersion = function(item) {
    var versionBody = item.toObject();
    versionBody._rid = versionBody._id;
    delete versionBody._id;
    app.formio.formio.mongoose.models.formrevision.create(versionBody);
  };

  const revisionPlans = ['trial', 'commercial'];

  const revisionEnabled = (project) => {
    return revisionPlans.includes(project.plan);
  };

  routes.hooks.put = {
    before: function(req, res, item, next) {
      if (item.components) {
        item.markModified('components');
      }
      if (item.revisions && revisionEnabled(req.primaryProject)) {
        incrementVersion(item);
      }
      return next();
    },
    after: function(req, res, item, next) {
      if (item.revisions && revisionEnabled(req.primaryProject)) {
        createVersion(item);
      }
      next();
    }
  };

  routes.hooks.patch = {
    before: function(req, res, item, next) {
      if (item.components && revisionEnabled(req.primaryProject)) {
        item.markModified('components');
      }
      if (item.revisions && revisionEnabled(req.primaryProject)) {
        incrementVersion(item);
      }
      return next();
    },
    after: function(req, res, item, next) {
      if (item.revisions && revisionEnabled(req.primaryProject)) {
        createVersion(item);
      }
      next();
    }
  };

  routes.hooks.post = {
    after: function(req, res, item, next) {
      if (item.revisions && revisionEnabled(req.primaryProject)) {
        createVersion(item);
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
