'use strict';

const _ = require('lodash');
const {transform} = require('../../util/util');

function omit(obj, omittedKeys) {
  return transform(obj, (key, value) => !omittedKeys.includes(key));
}

function writeExternalIdToSubmission(req, res, router, type, id) {
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
}

/**
   * Process the webhook response body
   *
   * @param response {Response} The webhook fetch response.
   * @param isDeleteRequest {boolean} Indicates whether or not the webhook request was of type DELETE.
   * @returns {Promise} A promise that resolves to the response body or an empty object (if we're ignoring the repsonse body)
   */
function processWebhookResponseBody(response, isDeleteRequest) {
  let bodyPromise = {};

  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length") === null || Number(response.headers.get("content-length"));

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

function getSubmission(req, res) {
  const submission = _.get(res, 'resource.previousItem') || _.get(res, 'resource.item') || _.cloneDeep(req.body) || {};
  return submission.toObject ? submission.toObject() : submission;
}

function getExternalId(submission, settings) {
  const externalIds = submission.externalIds || [];
  const externalIdType = settings.externalIdType || 'none';
  return externalIds.reduce((acc, curr) => curr.type === externalIdType ? curr.id : acc, '');
}

function stripReservedHeaders(headers) {
  const reservedHeaders = ['host', 'content-length', 'content-type', 'connection', 'cache-control'];
  return omit(headers, reservedHeaders);
}

/**
   * Util function to construct and parse the headers object for a webhook request.
   *
   * @param settings
   * @returns {*}
   */
function constructHeadersObject(req, settings) {
  let headers = {};
  if (settings.forwardHeaders) {
    const forwardedHeaders = _.clone(req.headers);
    headers = stripReservedHeaders(forwardedHeaders);
  }
  else {
    headers = {
      'Accept': '*/*'
    };
  }

  if (settings.username && settings.password) {
    const auth = Buffer.from(`${settings.username}:${settings.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  // Always set user agent to indicate it came from us.
  headers['user-agent'] = 'Form.io Webhook Action';
  headers['content-type'] = 'application/json';

  // Add custom headers.
  const customHeaders = settings.headers || [];
  customHeaders.forEach((header) => {
    if (header && header.header) {
      headers[header.header] = header.value;
    }
  });

  return headers;
}

module.exports = {
  writeExternalIdToSubmission,
  processWebhookResponseBody,
  constructHeadersObject,
  getSubmission,
  getExternalId
};
