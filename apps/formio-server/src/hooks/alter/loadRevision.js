'use strict';

module.exports = app => (instance, revision, type, done) => {
  const instanceRevision = app.formio.formio.mongoose.models[`${type}revision`];

  const findRevision = revision.length === 24 ? instanceRevision.findOne({_id: revision}) : instanceRevision.findOne({
    _rid: instance._id,
    _vid: parseInt(revision, 10)
  });

  findRevision.lean().exec((err, result) => {
    if (err) {
      return done(null, err);
    }
    done(result, null);
  });
};
