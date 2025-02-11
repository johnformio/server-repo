'use strict';

const _ = require('lodash');
const jsonPatch = require('fast-json-patch');

const Revision = require('./Revision');

const trackedProperties = ['data', 'state'];

module.exports = class FormRevision extends Revision {
  constructor(app, submissionModel) {
    super(app, 'submission', trackedProperties);
    if (submissionModel) {
      this.revisionModel = app.formio.formio.mongoose.model(`${submissionModel.modelName}_revisions`,
      app.formio.formio.schemas.submissionrevision, `${submissionModel.modelName}_revisions`);
      this.itemModel = submissionModel;
    }
    else {
      this.itemModel = this.app.formio.formio.mongoose.models.submission;
    }
  }

  async shouldCreateNewRevision(req, item, loadItem, form) {
    if (item.state === 'draft') {
      return false;
    }

    const loadItemData = loadItem && loadItem.data ? loadItem.data : {};
    const reqDate = req.body.data;
    try {
      const patch = jsonPatch.compare(loadItemData, reqDate)
      .map((operation) => {
        operation.path = `/data${operation.path}`;
        return operation;
      });
      if (patch.length === 0) {
        return false;
      }

      if (await super.shouldCreateNewRevision(req, item, loadItem, form)) {
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

  async createVersion(item, user, note) {
    const body = item.toObject();
    body._rid = body._id;

    if (user) {
      body._vuser = _.get(user, "data.email", user._id);
    }

    body._vnote = note || '';
    delete body._id;
    delete body.__v;
    if (!item.containRevisions) {
      item.containRevisions = true;
      await this.itemModel.updateOne({
        _id: item._id
      },
      {
        $set: item,
      });
      const revision = await this.revisionModel.create(body);
      return revision;
    }
    else {
      const revision = await this.revisionModel.create(body);
      return revision;
    }
  }

 async checkDraft(loadSubmission) {
  if (loadSubmission && loadSubmission.state === 'draft') {
    const revisions = await this.revisionModel.find({
      deleted: {$eq: null},
      _rid: loadSubmission._id
    })
    .sort('-modified')
    .lean();
    return loadSubmission = revisions[0] || undefined;
  }
  else {
    return loadSubmission;
  }
}

  async updateRevisionsSet(formId, user) {
    const submissions = await this.itemModel.find({
      form: formId,
      containRevisions:{$ne: true},
      deleted: {$eq: null}
    });

    for (const submission of submissions) {
      const revisions = await this.revisionModel.find({
        _rid: submission._id,
        deleted: {$eq: null}
      });
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
    }
  }
};
