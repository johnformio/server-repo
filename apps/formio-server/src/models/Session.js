'use strict';

module.exports = (router) => {
  const formio = router.formio;

  /* eslint-disable new-cap */
  const model = formio.BaseModel({
    schema: new formio.mongoose.Schema({
      owner: {
        type: formio.mongoose.Schema.Types.Mixed,
        ref: 'submission',
        index: true,
        required: true,
        set(owner) {
          // Attempt to convert to objectId.
          return formio.util.ObjectId(owner);
        },
        get(owner) {
          return owner ? owner.toString() : owner;
        },
      },
      loginAttempts: {
        type: Number,
        default: 0,
      },
      lastLoginAttemptAt: {
        type: Number,
        default: null,
      },
      locked: {
        type: Boolean,
        default: false,
      },
      issuedAt: {
        type: Number,
        default: null,
      },
      renewedAt: {
        type: Number,
        default: null,
      },
      deleted: {
        type: Number,
        default: null,
      },
    }),
  });
  /* eslint-enable new-cap */

  return model;
};
