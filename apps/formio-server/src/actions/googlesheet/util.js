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
        return next(err);
      }
      var clientId = settings.google.clientId;
      var clientSecret = settings.google.cskey;
      var refreshToken = settings.google.refreshtoken;

      if (!settings.google) {
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
