'use strict';
const Promise = require('bluebird');
module.exports = (formioServer) => {
  const formio = formioServer.formio;

  return async (req, form) => {
    const {resource, languageComponent, translationsComponent, defaultCode} =
      form?.settings?.translation || {};
    const languageCode = req.query.language || defaultCode;
    const translationResource = req.query.translationResource || resource;
    const languageComponentKey =
      req.query.languageComponent || languageComponent || 'language';
    const translationsComponentKey =
      req.query.translationsComponent || translationsComponent || 'translation';

    if (!languageCode) {
      return null;
    }

    const resourceQuery = {
      project: formio.util.idToBson(req.params.projectId),
      deleted: {$eq: null},
    };
    if (translationResource) {
      resourceQuery._id = translationResource;
    }
    else {
      resourceQuery.name = 'language';
    }

    try {
      const form = await Promise.promisify(
        formio.resources.form.model.findOne,
        {
          context: formio.resources.form.model,
        },
      )(resourceQuery);
      if (!form) {
        return null;
      }

      const submission = await Promise.promisify(
        formio.resources.submission.model.findOne,
        {
          context: formio.resources.submission.model,
        },
      )(
        {
          form: form._id,
          [`data.${languageComponentKey}`]: languageCode,
        },
        {
          [`data.${translationsComponentKey}`]: 1,
        },
      );

      return submission?.data?.[translationsComponentKey];
    }
    catch (err) {
      return null;
    }
  };
};
