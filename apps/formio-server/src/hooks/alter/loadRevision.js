'use strict';

module.exports = app => (form, revision, done) => {
  const formRevision = app.formio.formio.mongoose.models.formrevision;

  formRevision.findOne({
    _rid: form._id,
    _vid: parseInt(revision, 10)
  }).lean().exec((err, result) => {
    if (err) {
      return done(null, err);
    }
    done(result, null);
  });
};
