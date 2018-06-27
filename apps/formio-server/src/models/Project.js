'use strict';

/* eslint-disable no-useless-escape */
const _ = require('lodash');
const EncryptedProperty = require('../plugins/EncryptedProperty');
const invalidRegex = /[^0-9a-zA-Z\-]|^\-|\-$/;
/* eslint-enable no-useless-escape */

module.exports = function(router) {
  const formio = router.formio;
  /* eslint-disable new-cap, max-len */
  const model = formio.BaseModel({
    schema: new formio.mongoose.Schema({
      title: {
        type: String,
        description: 'The project title.',
        required: true,
        maxlength: 63
      },
      name: {
        type: String,
        description: 'The name of the project.',
        required: true,
        maxlength: 63,
        index: true,
        validate: [
          {
            message: 'A Project domain name may only contain letters, numbers, and hyphens (but cannot start or end with a hyphen)',
            validator(value) {
              return !invalidRegex.test(value);
            }
          },
          {
            message: 'This domain is reserved. Please use a different domain.',
            validator(value) {
              return !formio.config.reservedSubdomains || !_.includes(formio.config.reservedSubdomains, value);
            }
          },
          {
            isAsync: true,
            message: 'The Project name must be unique.',
            validator(value, done) {
              const search = {
                name: value,
                deleted: {$eq: null}
              };

              // Ignore the id if this is an update.
              if (this._id) {
                search._id = {$ne: this._id};
              }

              formio.mongoose.model('project').findOne(search).exec(function(err, result) {
                if (err || result) {
                  return done(false);
                }

                done(true);
              });
            }
          }
        ]
      },
      description: {
        type: String,
        description: 'A description for the project.',
        maxlength: 512
      },
      tag: {
        type: String,
        description: 'Last deployed tag of the project.',
        maxlength: 32,
        default: '0.0.0'
      },
      owner: {
        type: formio.mongoose.Schema.Types.ObjectId,
        ref: 'submission',
        index: true,
        default: null
      },
      project: {
        type: formio.mongoose.Schema.Types.ObjectId,
        description: 'The project Id of the project this environment is a part of.',
        ref: 'project',
        index: true
      },
      remote: {
        type: formio.mongoose.Schema.Types.Mixed,
        description: 'The remote project definition.',
        validate: [
          {
            isAsync: true,
            message: 'Remote already connected to an environment.',
            validator(value, done) {
              if (!value || !value.project || !value.project._id) {
                return done(true);
              }

              const search = {
                'remote.url': value.url,
                'remote.project._id': value.project._id,
                deleted: {$eq: null}
              };

              if (this._id) {
                search._id = {$ne: this._id};
              }

              formio.mongoose.model('project').findOne(search).exec(function(err, result) {
                if (err || result) {
                  return done(false);
                }

                return done(true);
              });
            }
          }
        ],
        set: function(value) {
          if (!value) {
            return null;
          }
          // Limit to only needed values.
          if (!value.project) {
            return value;
          }
          value.project = _.pick(value.project, ['name', 'title', '_id']);
          return value;
        }
      },
      plan: {
        type: String,
        enum: ['basic', 'independent', 'team', 'trial', 'commercial'],
        default: router.config.plan || 'commercial',
        index: true
      },
      billing: {
        type: formio.mongoose.Schema.Types.Mixed
      },
      steps: {
        type: [String]
      },
      framework: {
        type: String,
        enum: ['angular', 'angular2', 'react', 'vue', 'html5', 'simple', 'custom'],
        description: 'The target framework for the project.',
        default: 'angular',
        maxlength: 32
      },
      protect: {
        type: Boolean,
        default: false
      },
      primary: {
        type: Boolean,
        default: false
      },
      deleted: {
        type: Number,
        default: null
      },
      access: [formio.schemas.PermissionSchema],
      trial: {
        type: Date,
        description: 'The start date of the trial.',
        'default': Date.now,
        __readonly: true
      }
    })
  });
  /* eslint-enable new-cap, max-len */

  // Create a "recommended" index.
  model.schema.index({
    "access.roles": 1,
    "access.type": 1,
    "deleted": 1,
    "project": 1
  });

  // Encrypt 'settings' property at rest in MongoDB.
  model.schema.plugin(EncryptedProperty, {
    secret: formio.config.mongoSecret,
    plainName: 'settings'
  });

  // Add machineName to the schema.
  model.schema.plugin(require('formio/src/plugins/machineName')('project', formio));

  model.schema.machineName = function(document, done) {
    done(null, document.name);
  };

  return model;
};
