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
      default: ''
    },
    revisions: {
      type: String,
      enum: ['', 'current', 'original'],
      default: ''
    },
    _vid: {
      type: Number,
      description: 'The version id of the form.',
      index: true,
      required: true,
      default: 0
    }
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
    _vid: {
      type: Number,
      description: 'The version id of the submission.',
      index: true,
      required: true,
      default: 0
    },
    _fvid: {
      type: Number,
      description: 'The version id of the form when the submission was made.',
      index: true,
      required: true,
      default: 0
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
    }
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
  models.submission.schema.index({
    form: 1,
    project: 1,
    'data.email': 1,
    deleted: 1
  });

  // Add additional models.
  return _.assign(models, require('../../models/models')(app.formio, models));
};
