/*jslint node: true */
'use strict';

const _ = require('lodash');

module.exports = {
  /**
   * Verifying setting form data and restricting action form loading
   * if any of the setting field data missing.
   */
  checkOauthParameters: function(router, req, next) {
    router.formio.hook.settings(req, function(err, settings) {
      if (err) {
        return next(err.message || err);
      }

      if (!_.has(settings, 'google')) {
        return next('The Google Drive Data Connection must be configured to use the Google Sheets Action.');
      }
      if (!_.has(settings, 'google.clientId')) {
        return next('The Google Drive Client Id is required to use the Google Sheets Action.');
      }
      if (!_.has(settings, 'google.cskey')) {
        return next('The Google Drive Client Secret Key is required to use the Google Sheets Action.');
      }
      if (!_.has(settings, 'google.refreshtoken')) {
        return next('The Google Drive Refresh Token is required to use the Google Sheets Action.');
      }

      next();
    });
  }
};
