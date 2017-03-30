'use strict';

module.exports = function(router) {
  var formio = router.formio;
  /* eslint-disable new-cap */
  var model = formio.BaseModel({
    schema: new formio.mongoose.Schema({
      project: {
        type: router.formio.mongoose.Schema.Types.ObjectId,
        ref: 'project',
        index: true,
        required: true
      },
      version: {
        type: String,
        description: 'The version identifier.',
        maxlength: 32,
        required: true
      },
      definition: {
        type: router.formio.mongoose.Schema.Types.Mixed,
        description: 'The project version definition.'
      },
      owner: {
        type: router.formio.mongoose.Schema.Types.ObjectId,
        ref: 'submission',
        index: true,
        default: null
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
