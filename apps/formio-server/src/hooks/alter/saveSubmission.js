'use strict';
const _ = require('lodash');
const bcrypt = require('bcryptjs');

const generateError = (statusCode, message) => ({statusCode, message});

module.exports = (app) => async (req, settings) => {
  const {body, submission} = req;
  // Only execute on submission update
  if (req.method === 'POST' || !settings || !settings.passwordProtectedUpdate || !body || !submission) {
    return;
  }

  const {
    passwordProtectedUpdate,
    passwordField,
    updatePassword,
    newPasswordField,
  } = settings;

  if (
    (passwordProtectedUpdate && !passwordField) ||
    (updatePassword && !newPasswordField)
  ) {
    throw generateError(400, 'Missing password field configuration');
  }

  const submittedPassword = _.get(submission.data, passwordField);

  if (!submittedPassword) {
    throw generateError(400, 'Password not provided');
  }

  const sub = await app.formio.formio.cache.loadSubmissionAsync(req, body.form, body._id);

  if (!sub) {
    throw generateError(404, 'Submission not found');
  }

  const passwordHash = _.get(sub.data, passwordField);
  // Compare the provided password.
  const result = await bcrypt.compare(submittedPassword, passwordHash);

  if (!result) {
    throw generateError(403, 'Incorrect password');
  }

  if (updatePassword) {
    if (!_.get(submission.data, newPasswordField)) {
      throw generateError(403, 'New password not provided');
    }

    const newPasswordHash = _.get(body.data, newPasswordField);
    // Set new hashed password
    _.set(body.data, passwordField, newPasswordHash);
  }
};
