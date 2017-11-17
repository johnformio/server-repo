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
    revisions: {
      type: Boolean,
      default: false
    },
    _vid: {
      type: Number,
      description: 'The version id of the form.',
      index: true,
      required: true,
      default: 0
    }
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
    }
  });

  // Add additional models.
  return _.assign(models, require('../../models/models')(app.formio, models));
};
