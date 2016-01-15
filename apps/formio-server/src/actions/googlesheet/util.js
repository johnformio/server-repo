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
      var clientId = settings.googlesheet.clientId;
      var clientSecret = settings.googlesheet.cskey;
      var refreshToken = settings.googlesheet.refreshtoken;

      if (!settings.googlesheet) {
        return next('Googlesheet not configured.');
      }
      if (!clientId) {
        return next('Googlesheet not configured.');
      }
      if (!clientSecret) {
        return next('Googlesheet not configured.');
      }
      if (!refreshToken) {
        return next('Googlesheet not configured.');
      }
      next();
    });
  }
};
