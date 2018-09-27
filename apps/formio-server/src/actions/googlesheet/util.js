'use strict';

module.exports = {
  /**
   * Verifying setting form data and restricting action form loading
   * if any of the setting field data missing.
   */
  checkOauthParameters(router, req) {
    return new Promise((resolve, reject) => {
      router.formio.hook.settings(req, (err, settings) => {
        if (err) {
          return reject(err.message || err);
        }

        if (!settings.google) {
          return reject('The Google Drive Data Connection must be configured to use the Google Sheets Action.');
        }
        if (!settings.google.clientId) {
          return reject('The Google Drive Client Id is required to use the Google Sheets Action.');
        }
        if (!settings.google.cskey) {
          return reject('The Google Drive Client Secret Key is required to use the Google Sheets Action.');
        }
        if (!settings.google.refreshtoken) {
          return reject('The Google Drive Refresh Token is required to use the Google Sheets Action.');
        }

        resolve();
      });
    });
  }
};
