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
  let getProjectSettings = req => new Promise((resolve, reject) => {
    hook.settings(req, (err, settings) => {
      if (err) {
        return reject(err);
      }

      return resolve(settings);
    });
  });

  /**
   * Convert the moxtra settings url for environemnts to the base api url.
   *
   * Note: We need to convert it, because it stores the token generation endpoint and we can't auto update since all the
   * project settings are encrypted..
   *
   * @param req
   */
  let getEnvironmentUrl = req => getProjectSettings(req).then(settings => {
    if (!_.has(settings, 'moxtra.environment')) {
      throw 'No Moxtra environment found in the project settings.';
    }

    let url = _.get(settings, 'moxtra.environment');
    if (url.match(/api\.moxtra\.com/i)) {
      return `https://api.moxtra.com/`;
    }
    else if (url.match(/apisandbox\.moxtra\.com/i)) {
      return `https://apisandbox.moxtra.com/`;
    }

    throw `The Moxtra environment could not be determined from ${_.get(settings, `moxtra.environment`)}`;
  });

  /**
   * Get the auth token for a moxtra user.
   *
   * @param user
   * @param firstname
   * @param lastname
   * @returns {*|promise}
   */
  let getToken = (req, user, firstname, lastname) => getProjectSettings(req).then(settings => {
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
        timestamp: new Date().getTime()
      }
    };
    /* eslint-enable camelcase */

    if (_.has(user.data, firstname)) {
      body.data.firstname = _.get(user.data, firstname);
    }
    if (_.has(user.data, lastname)) {
      body.data.lastname = _.get(user.data, lastname);
    }

    // Add the orgId if present in the settings.
    if (_.has(settings, 'moxtra.orgId')) {
      body.data.orgid = _.get(settings, 'moxtra.orgId');
    }

    return new Promise((resolve, reject) => {
      rest.post(_.get(settings, 'moxtra.environment'), body)
      .on('complete', result => {
        debug(result);
        if (result instanceof Error) {
          return reject(result);
        }
        if (!_.has(result, 'access_token')) {
          return reject('No access token given.');
        }

        return resolve(result.access_token);
      });
    });
  });

  /**
   * Get a list of the binders using the given token
   *
   * @param token
   */
  let getBinder = (req, token, filter) => getEnvironmentUrl(req).then(baseUrl => {
    rest.post(`${baseUrl}/${filter ? filter : req.user._id}/binders`)
    .on('complete', result => {
      if (result instanceof Error) {
        throw result;
      }

      return result;
    });
  });

  return {
    getProjectSettings,
    getToken,
    getBinder
  }
};
