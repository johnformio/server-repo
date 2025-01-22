'use strict';

/**
 * A handler for tag based requests.
 *
 * @param router
 * @returns {Function}
 */
module.exports = (formio) => (req, res, next) => {
  const subRequest = formio.formio.util.createSubRequest(req);
  if (!subRequest) {
    throw new Error('Too many recursive requests.');
  }
  subRequest.query = {dryrun: true};
  subRequest.permissionsChecked = true;
  formio.resourcejs['/form/:formId/submission'].post(subRequest, res, next);
};
