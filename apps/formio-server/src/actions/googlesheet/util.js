/*jslint node: true */
'use strict';
module.exports = {
  /**
   * Verifying setting form data and restricting action form loading
   * if any of the setting field data missing.
   */
  checkOauthParameters: function(router, req, next) {
    router.formio.hook.settings(req, function(err, settings) {
      if (err) {
        return next();
      }
      var clientId = settings.googlesheet.google_clientId;
      var clientSecret = settings.googlesheet.cskey;
      var refreshToken = settings.googlesheet.refreshtoken;

      if (!settings.googlesheet) {
        return next('Googlesheet not configured.');
      }
      if (!clientId) {
        return next('Client ID is not properly configured. Please re-verify configuration parameters in settngs.');
      }
      if (!clientSecret) {
        return next('Client Secret Key is not properly configured.');
      }
      if (!refreshToken) {
        return next('Refreshtoken is not properly configured. Please re-verify configuration parameters in settngs.');
      }
      next();
    });
  }
};
