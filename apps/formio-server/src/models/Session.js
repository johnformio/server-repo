'use strict';

module.exports = (router) => {
  const formio = router.formio;

  /* eslint-disable new-cap */
  const model = formio.BaseModel({
    schema: new formio.mongoose.Schema({
      project: {
        type: formio.mongoose.Schema.Types.ObjectId,
        ref: 'project',
        required: true
      },
      form: {
        type: formio.mongoose.Schema.Types.ObjectId,
        ref: 'form',
        required: true
      },
      submission: {
        type: formio.mongoose.Schema.Types.ObjectId,
        ref: 'submission',
        index: true,
        required: true
      },
      logout: {
        type: Date,
        description: 'When the session was logged out.',
      }
    }),
  });
  /* eslint-enable new-cap */

  return model;
};
