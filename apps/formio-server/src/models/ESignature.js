'use strict';

module.exports = function(router) {
  const formio = router.formio;
  /* eslint-disable new-cap */
  const model = formio.BaseModel({
    schema: new formio.mongoose.Schema({
      signature: {
        type: String,
        index: true,
        required: true,
        description: 'The E-Signature token.',
      },
      _sid: {
        type: String,
        index: true,
        required: true,
        description: 'The submission ID.',
      },
      deleted: {
        type: Number,
        default: null
      }
    })
  });
  /* eslint-enable new-cap */

  // Add recommended index.
  model.schema.index({
    deleted: 1,
    created: -1
  });

  return model;
};
