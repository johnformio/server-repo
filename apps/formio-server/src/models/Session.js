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
      },
      submission: {
        type: formio.mongoose.Schema.Types.Mixed,
        ref: 'submission',
        index: true,
        required: true,
        set: id => {
          // Attempt to convert to objectId.
          return formio.util.ObjectId(id);
        },
        get: id => {
          return id ? id.toString() : id;
        }
      },
      logout: {
        type: Date,
        description: 'When the session was logged out.',
      },
      source: {
        type: String,
        description: 'What type of action resulted in the session'
      },
    }),
  });
  /* eslint-enable new-cap */

  return model;
};
