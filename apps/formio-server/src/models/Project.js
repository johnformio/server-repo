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
        index: true,
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
            message: 'The Project name must be unique.',
            async validator(value) {
                const search = {
                  name: value,
                  deleted: {$eq: null}
                };

                // Ignore the id if this is an update.
                if (this._id) {
                  search._id = {$ne: this._id};
                }

                try {
                  const result = await formio.mongoose.model('project').findOne(search).lean().exec();
                  if (result) {
                    return false;
                  }
                  return true;
                }
                catch (err) {
                  return false;
                }
            }
          }
        ]
      },
      type: {
        type: String,
        enum: ['project', 'stage', 'tenant'],
        default: 'project',
        index: true
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
        type: formio.mongoose.Schema.Types.Mixed,
        ref: 'submission',
        index: true,
        default: null,
        set: owner => {
          // Attempt to convert to objectId.
          return formio.util.ObjectId(owner);
        },
        get: owner => {
          return owner ? owner.toString() : owner;
        }
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
            message: 'Remote already connected to an environment.',
            async validator(value) {
                if (!value || !value.project || !value.project._id) {
                  return true;
                }

                const search = {
                  'remote.url': value.url,
                  'remote.project._id': value.project._id,
                  deleted: {$eq: null}
                };

                if (this._id) {
                  search._id = {$ne: this._id};
                }

                try {
                  const result = await formio.mongoose.model('project').findOne(search).lean().exec();
                  if (result) {
                    return false;
                  }
                  return true;
                }
                catch (err) {
                  return false;
                }
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
        enum: ['basic', 'independent', 'team', 'trial', 'commercial', 'archived'],
        default: router.config.plan || 'commercial',
        index: true
      },
      billing: {
        type: formio.mongoose.Schema.Types.Mixed
      },
      steps: {
        type: [String]
      },
      config: {
        type: formio.mongoose.Schema.Types.Mixed
      },
      framework: {
        type: String,
        enum: ['angular', 'angular2', 'react', 'vue', 'html5', 'simple', 'custom', 'aurelia', 'javascript'],
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
      },
      lastDeploy: {
        type: Date,
        description: 'The time of the last deploy.',
        __readonly: true
      },
      formDefaults: {
        type: formio.mongoose.Schema.Types.Mixed,
        default: null,
      },
      stageTitle: {
        type: String,
        description: 'The stage title.',
        maxlength: 63,
      },
      builderConfig: {
        type: formio.mongoose.Schema.Types.Mixed
      }
    })
  });
  /* eslint-enable new-cap, max-len */

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

  model.schema.post('findOne', async function(result, next) {
    if (!result || result.type !== 'tenant') {
      return next();
    }

    const project = await this.model.findOne({_id: result.project});
    if (project) {
      result.plan = project.plan;
    }
    next();
  });

  return model;
};
