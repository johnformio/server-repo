'use strict';

const _ = require('lodash');

module.exports = {
  setCustomExternalIdType(req, res, router, type, id) {
    const submissionModel = req.submissionModel || router.formio.resources.submission.model;
    return submissionModel.findOne(
      {_id: _.get(res, 'resource.item._id'), deleted: {$eq: null}}
    )
      .exec()
      .then((submission) => {
        submission.externalIds = submission.externalIds || [];

        // Either update the existing ID or create a new one.
        const found = submission.externalIds.find((externalId) => externalId.type === type);
        if (found) {
          found.id = id;
        }
        else {
          submission.externalIds.push({
            type,
            id
          });
        }

        return submission.save();
      })
      .catch(router.formio.util.log);
  }
};
