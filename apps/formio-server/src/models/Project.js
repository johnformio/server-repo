'use strict';

var _ = require('lodash');
var EncryptedProperty = require('../plugins/EncryptedProperty');
var invalidRegex = /[^0-9a-zA-Z\-]|^\-|\-$/;

module.exports = function(router) {
  var formio = router.formio;
  /* eslint-disable new-cap */
  var model = formio.BaseModel({
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
            validator: function(value) {
              return !invalidRegex.test(value);
            }
          },
          {
            message: 'This domain is reserved. Please use a different domain.',
            validator: function(value) {
              return !formio.config.reservedSubdomains || !_.includes(formio.config.reservedSubdomains, value);
            }
          },
          {
            isAsync: true,
            message: 'The Project name must be unique.',
            validator: function(value, done) {
              var search = {
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
      owner: {
        type: formio.mongoose.Schema.Types.ObjectId,
        ref: 'submission',
        index: true,
        default: null
      },
      plan: {
        type: String,
        enum: ['basic', 'independent', 'team', 'commercial'],
        default: router.config.plan || 'commercial',
        index: true
      },
      steps: {
        type: [String]
      },
      primary: {
        type: Boolean,
        default: false
      },
      deleted: {
        type: Number,
        default: null
      },
      access: [formio.schemas.PermissionSchema]
    })
  });
  /* eslint-enable new-cap */

  // Encrypt 'settings' property at rest in MongoDB.
  model.schema.plugin(EncryptedProperty, {
    secret: formio.config.mongoSecret,
    plainName: 'settings'
  });

  // Add machineName to the schema.
  model.schema.plugin(require('formio/src/plugins/machineName'));

  model.schema.machineName = function(document, done) {
    done(null, document.name);
  };

  return model;
};
