'use strict';

module.exports = app => async (form, submission, done) => {
  if (
    !submission.hasOwnProperty('_fvid') ||
    (form.hasOwnProperty('revisions') && (form.revisions === 'current')) ||
    form._vid === submission._fvid
  ) {
    return done();
  }

  // If the submission refers to a specific form revision, load it instead of the current form revision.
  const formRevision = app.formio.formio.mongoose.models.formrevision;
  try {
    const result = await formRevision.findOne({
      _rid: form._id,
      _vid: submission._fvid
    }).lean().exec();
    // If not found, return the original form.
    if (!result) {
      return done(form);
    }

    form.components = result.components;
    form.settings = result.settings;
    done(form);
  }
  catch (err) {
    // If error, return the original form.
    return done(form);
  }
};
