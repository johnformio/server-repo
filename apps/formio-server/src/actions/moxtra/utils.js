'use strict';

const rest = require('restler');
const _ = require('lodash');

module.exports = (router) => {
  const formio = router.formio;
  const hook = formio.hook;

  /**
   * Wrap the project settings request in a promise.
   *
   * @param {Object} req
   *
   * @returns {*|promise}
   */
  const getProjectSettings = req => new Promise((resolve, reject) => {
    hook.settings(req, (err, settings) => {
      if (err) {
        return reject(err);
      }

      return resolve(settings);
    });
  });

  /**
   * Convert the moxtra settings url for environments to the base api url.
   *
   * Note: We need to convert it, because it stores the token generation endpoint and we can't auto update since all the
   * project settings are encrypted..
   *
   * @param {Object} req
   *
   * @returns {*|promise}
   */
  const getEnvironmentUrl = req => getProjectSettings(req).then(settings => {
    if (!_.has(settings, 'moxtra.environment')) {
      throw 'No Moxtra environment found in the project settings.';
    }

    const url = _.get(settings, 'moxtra.environment');
    if (url.match(/api\.moxtra\.com/i)) {
      return `https://api.moxtra.com/v1`;
    }
    else if (url.match(/apisandbox\.moxtra\.com/i)) {
      return `https://apisandbox.moxtra.com/v1`;
    }

    throw `The Moxtra environment could not be determined from ${_.get(settings, `moxtra.environment`)}`;
  });

  /**
   * Get the auth token for a moxtra user.
   *
   * @param {Object} req
   * @param {Object|String} user
   * @param [String] firstname
   * @param [String] lastname
   *
   * @returns {*|promise}
   */
  const getToken = (req, user, firstname, lastname) => getProjectSettings(req).then(settings => {
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
    const body = {
      data: {
        client_id: _.get(settings, 'moxtra.clientId'),
        client_secret: _.get(settings, 'moxtra.clientSecret'),
        grant_type: 'http://www.moxtra.com/auth_uniqueid',
        uniqueid: (user._id || user || '').toString(),
        timestamp: (new Date()).getTime()
      }
    };
    /* eslint-enable camelcase */

    if (firstname && _.has(user.data, firstname)) {
      body.data.firstname = _.get(user.data, firstname);
    }
    if (lastname && _.has(user.data, lastname)) {
      body.data.lastname = _.get(user.data, lastname);
    }

    // Add the orgId if present in the settings.
    if (_.has(settings, 'moxtra.orgId')) {
      body.data.orgid = _.get(settings, 'moxtra.orgId');
    }

    return new Promise((resolve, reject) => {
      rest.post(_.get(settings, 'moxtra.environment'), body)
      .on('complete', result => {
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
   * Get the auth token for administrative use within moxtra.
   *
   * @param {Object} req
   * @param {Object|String} project
   *
   * @returns {*|promise}
   */
  const getFormioBotToken = (req, project) => getProjectSettings(req).then(settings => {
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
    const data = {
      client_id: _.get(settings, 'moxtra.clientId'),
      client_secret: _.get(settings, 'moxtra.clientSecret'),
      grant_type: 'http://www.moxtra.com/auth_uniqueid',
      uniqueid: (project._id || project || '').toString(),
      timestamp: (new Date()).getTime(),
      firstname: `Form.io`,
      lastname: `Bot`,
      admin: true
    };
    /* eslint-enable camelcase */

    // Add the orgId if present in the settings.
    if (_.has(settings, 'moxtra.orgId')) {
      data.orgid = _.get(settings, 'moxtra.orgId');
    }

    return new Promise((resolve, reject) => {
      rest.post(_.get(settings, 'moxtra.environment'), {data})
      .on('complete', result => {
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
   * Get a list of the binders using the given token.
   *
   * @param {Object} req
   * @param {String} token
   * @param [String] filter
   *
   * @returns {*|promise}
   */
  const getBinder = (req, token, filter) => getEnvironmentUrl(req).then(baseUrl => {
    const url = `${baseUrl}/${filter ? filter : `me`}/binders`;
    const headers = {
      'Authorization': `BEARER ${token}`,
      'Accept': `*/*`
    };

    return new Promise((resolve, reject) => {
      rest.get(url, {headers})
      .on('complete', result => {
        if (result instanceof Error || _.has(result, 'error')) {
          return reject(result);
        }

        return resolve(result.data);
      });
    });
  });

  /**
   * Add a message to the given binder.
   *
   * @param {Object} req
   * @param {String} message
   * @param {String} binder
   * @param {String} token
   *
   * @returns {*|promise}
   */
  const addMessageToBinder = (req, message, binder, token) => getEnvironmentUrl(req).then(baseUrl => {
    const url = `${baseUrl}/${binder}/comments`;
    const headers = {
      'Authorization': `BEARER ${token}`,
      'Accept': `*/*`
    };

    return new Promise((resolve, reject) => {
      rest.postJson(url, {text: message}, {headers})
      .on('complete', result => {
        if (result instanceof Error || _.has(result, 'error')) {
          return reject(result);
        }

        return resolve(result.data);
      });
    });
  });

  /**
   * Add a to-do to the given binder.
   *
   * @param {Object} req
   * @param {String} name
   * @param {String} message
   * @param {String} binder
   * @param {String} token
   *
   * @returns {*|promise}
   */
  const addTodoToBinder = (req, name, description, binder, token) => getEnvironmentUrl(req).then(baseUrl => {
    const url = `${baseUrl}/${binder}/todos`;
    const headers = {
      'Authorization': `BEARER ${token}`,
      'Accept': `*/*`
    };

    return new Promise((resolve, reject) => {
      rest.postJson(url, {name, description}, {headers})
        .on('complete', result => {
          if (result instanceof Error || _.has(result, 'error')) {
            return reject(result);
          }

          return resolve(result.data);
        });
    });
  });

  /**
   * Removes a given user from the org.
   *
   * @param {Object} req
   * @param {String} org
   * @param {String} user
   * @param {String} token
   *
   * @returns {*|promise}
   */
  const removeUserFromOrg = (req, org, user, token) => getEnvironmentUrl(req).then(baseUrl => {
    const url = `${baseUrl}/${org}/users/${user}?remove=true&binders=true`;
    const headers = {
      'Authorization': `BEARER ${token}`,
      'Accept': `*/*`
    };

    return new Promise((resolve, reject) => {
      rest.del(url, {headers})
        .on('complete', result => {
          if (result instanceof Error || _.has(result, 'error')) {
            return reject(result);
          }

          return resolve(result.data || result);
        });
    });
  });

  return {
    getProjectSettings,
    getToken,
    getFormioBotToken,
    getBinder,
    addMessageToBinder,
    addTodoToBinder,
    removeUserFromOrg
  };
};
