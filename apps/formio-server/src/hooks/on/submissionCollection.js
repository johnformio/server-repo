'use strict';

module.exports = app => req => {
  let submissionModel = null;

  app.formio.formio.cache.loadCurrentForm(req, (err, form) => {
    if (err) {
      return null;
    }
    if (!form) {
      return null;
    }
    if (!(form.settings && form.settings.collection)) {
      return null;
    }

    const projectName = req.currentProject.name.replace(/[^A-Za-z0-9]+/g, '');
    const collection = form.settings.collection;
    submissionModel = app.formio.formio.mongoose.model(
      `${projectName}_${collection}`,
      app.formio.formio.mongoose.modelSchemas.submission,
      `${projectName}_${collection}`
    );
  });

  return submissionModel;
};

