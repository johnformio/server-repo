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
    },
    owner: {
      type: app.formio.formio.mongoose.Schema.Types.Mixed,
      ref: 'submission',
      index: true,
      default: null,
      set: owner => {
        // Attempt to convert to objectId.
        try {
          return app.formio.formio.util.ObjectId(owner);
        }
        catch (e) {
          return owner;
        }
      }
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
    },
    owner: {
      type: app.formio.formio.mongoose.Schema.Types.Mixed,
      ref: 'submission',
      index: true,
      default: null,
      set: owner => {
        // Attempt to convert to objectId.
        try {
          return app.formio.formio.util.ObjectId(owner);
        }
        catch (e) {
          return owner;
        }
      }
    }
  });

  // Add additional models.
  return _.assign(models, require('../../models/models')(app.formio, models));
};
