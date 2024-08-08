'use strict';

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
      const form = await formio.resources.form.model.findOne(resourceQuery).exec();
      if (!form) {
        return null;
      }

      const submission = await formio.resources.submission.model.findOne(
        {
          form: form._id,
          [`data.${languageComponentKey}`]: languageCode,
        },
        {
          [`data.${translationsComponentKey}`]: 1,
        },
      ).exec();

      return submission?.data?.[translationsComponentKey];
    }
    catch (err) {
      return null;
    }
  };
};
