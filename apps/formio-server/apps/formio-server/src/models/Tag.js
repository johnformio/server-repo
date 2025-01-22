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
            message: 'The tag must be unique.',
            async validator(value) {
                if (this.chunk) {
                  return true;
                }
                const search = {
                  project: this.project,
                  tag: value,
                  deleted: {$eq: null},
                  chunk: {$ne: true}
                };

                // Ignore the id if this is an update.
                if (this._id) {
                  search._id = {$ne: this._id};
                }

                try {
                  const result = await formio.mongoose.model('tag').findOne(search).lean().exec();
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
      },
      chunk: {
        type: Boolean
      },
    })
  });
  /* eslint-enable new-cap */

  // Add recommended index.
  model.schema.index({
    project: 1,
    deleted: 1,
    created: -1
  });

  return model;
};
