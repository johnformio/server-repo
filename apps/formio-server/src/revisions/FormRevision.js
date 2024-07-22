'use strict';
const _ = require('lodash');
const Revision = require('./Revision');
const config = require('../../config');

const trackedProperties = ['components', 'settings', 'tags', 'properties', 'controller'];
module.exports = class FormRevision extends Revision {
  constructor(app) {
    super(app, 'form', trackedProperties);
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

  async createVersion(item, user ,note, done) {
    const body = item.toObject();
    body._rid = body._id;

    if (user) {
      body._vuser = _.get(user, "data.name") || _.get(user, "data.email", user._id);
    }

    body._vnote = note || '';
    delete body._id;
    delete body.__v;

    try {
      const result = await this.revisionModel.findOne({
        _rid: body._rid,
        _vid: 'draft'
      }).exec();
      // If a draft exists, overwrite it.
        if (result) {
          result.set(body);
          const revision = await this.revisionModel.findOneAndUpdate({_id: result._id}, result);
          return done(null, revision);
        }
      // Otherwise create a new entry.
      const revision = await this.revisionModel.create(body);
      return done(null, revision);
    }
    catch (err) {
      return done(err);
    }
  }
};
