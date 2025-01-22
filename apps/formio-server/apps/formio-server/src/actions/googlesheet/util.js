'use strict';

module.exports = {
  /**
   * Verifying setting form data and restricting action form loading
   * if any of the setting field data missing.
   */
  async checkOauthParameters(router, req) {
        const settings = await router.formio.hook.settings(req);
        if (!settings.google) {
          throw ('The Google Drive Data Connection must be configured to use the Google Sheets Action.');
        }
        if (!settings.google.clientId) {
          throw ('The Google Drive Client Id is required to use the Google Sheets Action.');
        }
        if (!settings.google.cskey) {
          throw ('The Google Drive Client Secret Key is required to use the Google Sheets Action.');
        }
        if (!settings.google.refreshtoken) {
          throw ('The Google Drive Refresh Token is required to use the Google Sheets Action.');
        }
        return;
  }
};
