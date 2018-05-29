'use strict';

const hubspotApi = require('node-hubspot');
const debug = require('debug')('formio:hubspot:util');

module.exports = {
  /**
   * Connect to Hubspot.
   *
   * @param router
   * @param req
   * @returns {*}
   */
  connect(router, req, next) {
    router.formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug(err.message || err);
        return next(err.message || err);
      }
      if (!settings) {
        return next('No settings found.');
      }
      if (!settings.hubspot) {
        return next('Hubspot not configured.');
      }
      if (!settings.hubspot.apikey) {
        return next('Hubspot not configured.');
      }

      /* eslint-disable */
      let hubspot = hubspotApi({
        api_key: settings.hubspot.apikey,
        version: 'v3'
      });
      /* eslint-enable */

      next(null, hubspot);
    });
  }
};
