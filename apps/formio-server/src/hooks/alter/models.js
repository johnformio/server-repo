'use strict';

const _ = require('lodash');

module.exports = app => models => {
  models.form.schema.add({
    project: {
      type: app.formio.formio.mongoose.Schema.Types.ObjectId,
      ref: 'project',
      index: true,
      required: true
    },
    controller: {
      type: String,
    },
    revisions: {
      type: String,
      enum: ['', 'current', 'original'],
      default: ''
    },
    submissionRevisions: {
      type: String,
      default: ''
    },
    _vid: {
      type: Number,
      description: 'The version id of the form.',
      index: true,
      required: true,
      default: 0
    },
    esign: {
      type:  app.formio.formio.mongoose.Schema.Types.Mixed,
      description: 'The form.io E-Signature settings.',
      default: {}
    },
  });

  // Add a suggested indexes.
  models.form.schema.index({
    project: 1,
    type: 1,
    deleted: 1,
    modified: -1
  });
  models.form.schema.index({
    project: 1,
    name: 1,
    deleted: 1
  });

  models.submission.schema.add({
    _fvid: {
      type: Number,
      description: 'The version id of the form when the submission was made.',
      index: true,
      required: true,
      default: 0
    },
    _frid: {
      type: app.formio.formio.mongoose.Schema.Types.ObjectId,
      description: 'The id of the form revision when the submission was made.',
      index: true
    },
    project: {
      type: app.formio.formio.mongoose.Schema.Types.ObjectId,
      ref: 'project',
      index: true,
      required: true
    },
    state: {
      type: String,
      description: 'The current state of the submission',
      index: true,
      default: 'submitted'
    },
    containRevisions: {
      type: Boolean
    },
    eSignatures: {
      type: [app.formio.formio.mongoose.Schema.Types.ObjectId],
      default: []
    },
    stage: {
      type: String,
      description: 'The current stage of the submission',
    },
  });

  // Add a suggested indexes.
  models.submission.schema.index({
    form: 1,
    project: 1,
    deleted: 1
  });
  models.submission.schema.index({
    project: 1,
    deleted: 1
  });
  // Add the case sensitive index for MongoDB-compliant APIs
  if (app.formio.formio.mongoFeatures.collation && app.formio.formio.mongoFeatures.compoundIndexWithNestedPath) {
    models.submission.schema.index({
      form: 1,
      project: 1,
      'data.email': 1,
      deleted: 1
    }, {collation: {locale: 'en', strength: 2}});
  }
  else if (app.formio.formio.mongoFeatures.compoundIndexWithNestedPath) {
    models.submission.schema.index({
      form: 1,
      project: 1,
      'data.email': 1,
      deleted: 1
    });
  }

  // Add additional models.
  return _.assign(models, require('../../models/models')(app.formio, models));
};
