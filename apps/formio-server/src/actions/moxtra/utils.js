'use strict';

let rest = require('restler');
var _ = require('lodash');
var debug = require('debug')('formio:actions:moxtra#util');

module.exports = (router) => {
  let formio = router.formio;
  let hook = formio.hook;
  let util = formio.util;

  /**
   * Wrap the project settings request in a promise.
   *
   * @returns {*|promise}
   */
  let getProjectSettings = () => {
    return new Promise((resolve, reject) => {
      hook.settings(req, (err, settings) => {
        if (err) {
          return reject(err);
        }

        return resolve(settings);
      });
    });
  };

  /**
   * Get the auth token for a moxtra user.
   *
   * @param user
   * @param firstname
   * @param lastname
   * @returns {*|promise}
   */
  let getToken = (user, firstname, lastname) => {
    return getProjectSettings()
    .then((settings) => {
      if (!_.has(settings, 'moxtra.clientId')) {
        throw 'No Moxtra clientId found in the project settings.';
      }

      if (!_.has(settings, 'moxtra.clientSecret')) {
        throw 'No Moxtra clientSecret found in the project settings.';
      }

      if (!_.has(settings, 'moxtra.environment')) {
        throw 'No Moxtra environment found in the project settings.';
      }

      /* eslint-disable camelcase */
      let body = {
        data: {
          client_id: _.get(settings, 'moxtra.clientId'),
          client_secret: _.get(settings, 'moxtra.clientSecret'),
          grant_type: 'http://www.moxtra.com/auth_uniqueid',
          uniqueid: user._id.toString(),
          timestamp: new Date().getTime(),
          firstname: _.get(user.data, firstname),
          lastname: _.get(user.data, lastname)
        }
      };
      /* eslint-enable camelcase */

      // Add the orgId if present in the settings.
      if (_.has(settings, 'moxtra.orgId')) {
        body.data.orgid = _.get(settings, 'moxtra.orgId');
      }

      rest.post(_.get(settings, 'moxtra.environment'), body)
        .on('complete', function(result) {
          debug(result);
          if (result instanceof Error) {
            throw result;
          }
          if (!_.has(result, 'access_token')) {
            throw 'No access token given.';
          }

          return result.access_token;
        });
    });
  };

  return {
    getProjectSettings,
    getToken
  }
};
