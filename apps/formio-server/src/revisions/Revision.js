'use strict';
const _ = require('lodash');
const async = require('async');

module.exports = class Revision {
  constructor(app, type, trackedProperties, revisionPlans) {
    this.revisionPlans = revisionPlans || ['trial', 'commercial'];
    this.type = type;
    this.trackedProperties = trackedProperties || [];
    this.revisionModel = app.formio.formio.mongoose.models[`${type}revision`];
    this.app = app;
    this.idToBson = app.formio.formio.util.idToBson;
  }

  checkRevisionPlane(plan) {
    return this.revisionPlans.includes(plan);
  }

  shouldCreateNewRevision(req, item, loadItem, form) {
    const currentFormTrackedProperties = _.pick(loadItem, this.trackedProperties);
    const updatedFormTrackedProperties = _.pick(req.body, this.trackedProperties);
    const isChanged = !_.isEqual(currentFormTrackedProperties, updatedFormTrackedProperties);
    const areRevisionsAllowed = (item.revisions || form && form[`${this.type}Revisions`]) && this.revisionPlans.includes(req.primaryProject.plan);
    return (
      req.isDraft ||
      item.revisions && !form.revisions ||
      (areRevisionsAllowed && isChanged)
    );
  }

  delete(rid, next) {
    this.revisionModel.find({
      _rid: this.idToBson(rid),
      deleted: {$eq: null}
    }).exec((err, revisions) => {
      if (err) {
        return next(err);
      }
      if (!revisions || revisions.length === 0) {
        return next();
      }

      async.eachSeries(revisions, function(revision, cb) {
        revision.deleted = Date.now();
        revision.markModified('deleted'); // ?
        revision.save(function(err) {
          if (err) {
            return cb(err);
          }

          cb();
        });
      }, function(err) {
        if (err) {
          return next(err);
        }

        next();
      });
    });
  }
};
