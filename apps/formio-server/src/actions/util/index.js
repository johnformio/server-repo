'use strict';

const _ = require('lodash');

module.exports = {
  writeExternalIdToSubmission(req, res, router, type, id) {
    const submissionModel = req.submissionModel || router.formio.resources.submission.model;
    return submissionModel.findOne(
      {_id: _.get(res, 'resource.item._id'), deleted: {$eq: null}}
    )
      .exec()
      .then((submission) => {
        if (!submission) {
          return;
        }
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
  },

  /**
     * Process the webhook response body
     *
     * @param response {Response} The webhook fetch response.
     * @param isDeleteRequest {boolean} Indicates whether or not the webhook request was of type DELETE.
     * @returns {Promise} A promise that resolves to the response body or an empty object (if we're ignoring the repsonse body)
     */
  processWebhookResponseBody(response, isDeleteRequest) {
    // TODO: ascertain whether below concern about delete requests (FOR-2722) is warranted here, this function should be
    // integrated with the parseUnkownContentResponse util
    let bodyPromise = {};

    const contentType = response.headers.get("content-type");
    const contentLength = Number(response.headers.get("content-length"));

    // Restore the delete request check to ensure fidelity with fixes implemented in FOR-2722
    if (!isDeleteRequest && contentLength > 0) {
      if (contentType.includes('application/json')) {
        bodyPromise = response.json();
      }
      else if (contentType.includes('text/plain') || contentType.includes('text/html')) {
        bodyPromise = response.text();
      }
    }
    return bodyPromise;
  }
};
