'use strict';

module.exports = app => (instance, revision, model, done) => {
  const findRevision = revision.length === 24 ? model.findOne({_id: revision}) : model.findOne({
    _rid: instance._id,
    _vid: parseInt(revision, 10)
  });

  findRevision.lean().exec((err, result) => {
    if (err) {
      return done(err);
    }
    done(null, result);
  });
};
