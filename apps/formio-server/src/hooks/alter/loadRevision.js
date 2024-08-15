'use strict';

module.exports = app => (instance, revision, model, done) => {
  const query = [];
  if (revision.length === 24) {
    query.push({_id: revision});
    if (instance.type === 'form') {
      query.push({revisionId: revision});
    }
  }
  else {
    query.push({
      _rid: instance._id,
      _vid: parseInt(revision, 10)
    });
  }
  const findRevision = model.findOne({$or: query});

  findRevision.lean().exec((err, result) => {
    if (err) {
      return done(err);
    }
    done(null, result);
  });
};
