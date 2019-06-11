'use strict';

module.exports = function(router) {
  const formio = router.formio;
  /* eslint-disable new-cap */
  const model = formio.BaseModel({
    schema: new formio.mongoose.Schema({
      project: {
        type: router.formio.mongoose.Schema.Types.ObjectId,
        ref: 'project',
        index: true,
        required: true
      },
      tag: {
        type: String,
        description: 'The tag identifier.',
        maxlength: 32,
        required: true,
        validate: [
          {
            isAsync: true,
            message: 'The tag must be unique.',
            validator(value, done) {
              const search = {
                project: this.project,
                tag: value,
                deleted: {$eq: null}
              };

              // Ignore the id if this is an update.
              if (this._id) {
                search._id = {$ne: this._id};
              }

              formio.mongoose.model('tag').findOne(search).lean().exec(function(err, result) {
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
        maxlength: 256,
        description: 'A description of the tag'
      },
      template: {
        type: router.formio.mongoose.Schema.Types.Mixed,
        description: 'The project template.'
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
      deleted: {
        type: Number,
        default: null
      }
    })
  });
  /* eslint-enable new-cap */

  return model;
};
