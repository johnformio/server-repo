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
      template: {
        type: router.formio.mongoose.Schema.Types.Mixed,
        description: 'The project version template.'
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

  // Validate the uniqueness of the value given for the version.
  model.schema.path('version').validate(function(value, done) {
    var search = {
      project: this.project,
      version: value,
      deleted: {$eq: null}
    };

    formio.mongoose.model('version').findOne(search).exec(function(err, result) {
      if (err || result) {
        return done(false);
      }

      done(true);
    });
  }, 'The version must be unique.');

  return model;
};
