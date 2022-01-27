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
    const rewriteDate = (obj) => _.mapValues(obj, component => component && component.constructor && component.constructor.name === 'Date'? component.toUTCString() : component);
    const rewriteStructure = (obj) => _.mapValues(obj, component => undefined);
    const rewriteDateDeep = (data, fn) => {
      const result = {};
      _.forIn(data, (value, key) => {
        if (value && typeof value === 'object' && !Array.isArray(value) && value.constructor.name !== 'Date') {
          Object.assign(result, {[key]: rewriteDateDeep(value, fn)});
        }
        else {
          if (Array.isArray(value)) {
            value = value.map(item=>fn(item));
          }
          Object.assign(result, fn({[key] : value}));
        }
      });
      return result;
    };
    if (item.state === 'draft') {
      return false;
    }

    const loadItemData = loadItem && loadItem.data ? rewriteDateDeep(loadItem.data, rewriteDate) : rewriteDateDeep(req.body.data, rewriteStructure);
    const reqDate = rewriteDateDeep(req.body.data, rewriteDate);
    const patch = jsonPatch.compare(loadItemData, reqDate)
      .map((operation) => {
        operation.path = `/data${operation.path}`;
        return operation;
      });
    if (patch.length === 0) {
      return false;
    }
    if (loadItem && loadItem.data) {
      _.set(req.body.metadata, 'previousData', loadItem.data);
    }
    _.set(req.body.metadata, 'jsonPatch', patch);
    return Revision.prototype.shouldCreateNewRevision.call(this, req, item, loadItem, form);
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

    return this.revisionModel.create(body, done);
 }
};

