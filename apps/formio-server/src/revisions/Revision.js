'use strict';
const _ = require('lodash');
const config = require('../../config');
module.exports = class Revision {
  constructor(app, type, trackedProperties, revisionPlans) {
    this.revisionPlans = revisionPlans || ['trial', 'commercial'];
    this.type = type;
    this.trackedProperties = trackedProperties || [];
    this.revisionModel = app.formio.formio.mongoose.models[`${type}revision`];
    this.app = app;
    this.idToBson = app.formio.formio.util.idToBson;
    this.itemModel = app.formio.formio.mongoose.models[type];
  }

  checkRevisionPlan(plan) {
    return this.revisionPlans.includes(plan);
  }

  revisionsAllowed(req) {
    return this.checkRevisionPlan(req.primaryProject.plan) &&
      !config.formio.hosted &&
      (this.app.license && !this.app.license.licenseServerError && _.get(req, 'licenseTerms.options.sac', false));
  }

  shouldCreateNewRevision(req, item, loadItem, form) {
    if (!this.revisionsAllowed(req)) {
      return false;
    }

    const currentFormTrackedProperties = _.pick(loadItem, this.trackedProperties);
    const updatedFormTrackedProperties = _.pick(req.body, this.trackedProperties);
    const isChanged = !_.isEqual(currentFormTrackedProperties, updatedFormTrackedProperties);
    const areRevisionsAllowed = (item.revisions || form && form[`${this.type}Revisions`]);
    return (
      req.isDraft ||
      item.revisions && !form.revisions ||
      (areRevisionsAllowed && isChanged)
    );
  }

  delete(rid, next) {
    this.revisionModel.updateMany(
      {
        _rid: this.idToBson(rid),
        deleted: {$eq: null}
      },
      {
        deleted: Date.now(),
        markModified: 'deleted'
      },
      (err) => {
        if (err) {
          return next(err);
        }
        next();
      }
    );
  }
};
