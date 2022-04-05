'use strict';

const _ = require('lodash');
const jsonPatch = require('fast-json-patch');

const Revision = require('./Revision');

const trackedProperties = ['data', 'state'];

module.exports = class FormRevision extends Revision {
  constructor(app) {
    super(app, 'submission', trackedProperties);
  }

  shouldCreateNewRevision(req, item, loadItem, form) {
    const rewriteDate = (item) => {
      if (typeof item === 'object' && !Array.isArray(item)) {
        return _.mapValues(item, component => component && component.constructor && component.constructor.name === 'Date'? component.toUTCString() : component);
      }
      else {
        return item;
      }
    };
    const rewriteDateDeep = (data, fn) => {
      const result = {};
      _.forIn(data, (value, key) => {
        if (value && typeof value === 'object' && !Array.isArray(value) && value.constructor.name !== 'Date') {
          Object.assign(result, {[key]: rewriteDateDeep(value, fn)});
        }
        else {
          if (Array.isArray(value)) {
            Object.assign(result, {[key] : value.map(item=>fn(item))});
          }
          else {
            Object.assign(result, fn({[key] : value}));
          }
        }
      });
      return result;
    };
    if (item.state === 'draft') {
      return false;
    }

  const loadItemData = loadItem && loadItem.data ? rewriteDateDeep(loadItem.data, rewriteDate) : {};

    const reqDate = rewriteDateDeep(req.body.data, rewriteDate);
    try {
      const patch = jsonPatch.compare(loadItemData, reqDate)
      .map((operation) => {
        operation.path = `/data${operation.path}`;
        return operation;
      });
      if (patch.length === 0) {
        return false;
      }

      if (Revision.prototype.shouldCreateNewRevision.call(this, req, item, loadItem, form)) {
        if (loadItem && loadItem.data) {
          _.set(req.body.metadata, 'previousData', loadItem.data);
        }
        _.set(req.body.metadata, 'jsonPatch', patch);
        return true;
      }
      return false;
    }
    catch (e) {
      //
    }
  }

  createVersion(item, user, note, done) {
    const body = item.toObject();
    body._rid = body._id;

    if (user) {
      body._vuser = _.get(user, "data.email", user._id);
    }

    body._vnote = note || '';
    delete body._id;
    delete body.__v;
    item.containRevisions = true;
    item.save();
    return this.revisionModel.create(body, done);
 }

 updateRevisionsSet(formId, user, done) {
  this.app.formio.formio.mongoose.models.submission.find({
    form: formId,
    containRevisions:{$ne: true},
    deleted: {$eq: null}
  })
  .then((submissions) => {
    submissions.forEach(submission => {
      this.revisionModel.find({
        _rid: submission._id,
        deleted: {$eq: null}
      })
      .then((revisions)=>{
        const prevRevisionData = revisions.length > 0 ? revisions.reduce((prev, current) => (prev.created > current.created) ? prev : current).data : {};
        const patch = jsonPatch.compare(prevRevisionData, submission.data)
        .map((operation) => {
          operation.path = `/data${operation.path}`;
          return operation;
        });
        if (patch.length > 0) {
          _.set(submission.metadata, 'jsonPatch', patch);
          if (!_.isEmpty(prevRevisionData)) {
             _.set(submission.metadata, 'previousData', prevRevisionData);
          }
          this.createVersion(submission, user);
        }
      });
    });
    done();
  });
}
};

