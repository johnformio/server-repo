'use strict';

const debug = require('debug')('formio:resource:tag');

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
        required: true
      },
      template: {
        type: router.formio.mongoose.Schema.Types.Mixed,
        description: 'The project template.'
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

  // Validate the uniqueness of the value given for the tag.
  model.schema.path('tag').validate(function(value, done) {
    const search = {
      project: this.project,
      tag: value,
      deleted: {$eq: null}
    };
    debug(search);

    // Ignore the id if this is an update.
    if (this._id) {
      search._id = {$ne: this._id};
    }

    formio.mongoose.model('tag').findOne(search).exec(function(err, result) {
      if (err || result) {
        debug('Tag exists');
        return done(false);
      }

      done(true);
    });
  }, 'The tag must be unique.');

  return model;
};
