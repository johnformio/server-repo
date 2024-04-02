'use strict';
const Promise = require('bluebird');
module.exports = (formioServer) => {
  const formio = formioServer.formio;

  return async (req) => {
    if (!req.query.language) {
      return null;
    }

    try {
      const form = await Promise.promisify(formio.resources.form.model.findOne, {
        context: formio.resources.form.model,
      })({
        project: formio.util.idToBson(req.params.projectId),
        deleted: {'$eq': null},
        name: 'language',
      });
      if (!form) {
        return null;
      }

      const submission = await Promise.promisify(formio.resources.submission.model.findOne, {
        context: formio.resources.submission.model,
      })({
        form: form._id,
        'data.language': req.query.language,
      }, {
        'data.translation': 1,
      });

      return submission?.data?.translation;
    }
    catch (err) {
      return null;
    }
  };
};
