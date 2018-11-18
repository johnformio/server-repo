'use strict';

module.exports = app => (form, submission, done) => {
  if (!submission.hasOwnProperty('_fvid')) {
    return done();
  }

  // If the submission refers to a specific form reivision, load it instead of the current form revision.
  const formRevision = app.formio.formio.mongoose.models.formrevision;
  formRevision.findOne({
    _rid: form._id,
    _vid: submission._fvid
  }).lean().exec((err, result) => {
    // If error or not found, return the original form.
    if (err || !result) {
      return done(form);
    }

    form.components = result.components;
    done(form);
  });
};
