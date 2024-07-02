'use strict';
const _ = require('lodash');
const Revision = require('./Revision');
const config = require('../../config');

module.exports = class FormRevision extends Revision {
  constructor(app) {
    super(app, 'form', FormRevision.defaultTrackedProperties);
  }

  static get defaultTrackedProperties() {
    return ['components', 'settings', 'tags', 'properties', 'controller', 'esign'];
  }

  revisionsAllowed(req) {
    return super.revisionsAllowed(req) || (this.checkRevisionPlan(req.primaryProject.plan) && config.formio.hosted);
  }

  shouldCreateNewRevision(req, item, loadItem) {
    return Revision.prototype.shouldCreateNewRevision.call(this, req, item, loadItem, loadItem);
  }

  incrementVersion(item) {
    item.set('_vid', item.get('_vid') + 1);
  }

  createVersion(item, user ,note, done) {
    const body = item.toObject();
    body._rid = body._id;

    if (user) {
      body._vuser = _.get(user, "data.name") || _.get(user, "data.email", user._id);
    }

    body._vnote = note || '';
    delete body._id;
    delete body.__v;

   this.revisionModel.findOne({
      _rid: body._rid,
      _vid: 'draft'
    }).exec((err, result)=>{
      if (err) {
        return done(err);
      }
      // If a draft exists, overwrite it.
          if (result) {
              result.set(body);
              return this.revisionModel.findOneAndUpdate({_id: result._id}, result, done);
          }
      // Otherwise create a new entry.
      this.revisionModel.create(body, done);
    });
    }
};
