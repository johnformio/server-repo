'use strict';

var rest = require('restler');
var Q = require('q');
var _ = require('lodash');
var debug = require('debug')('formio:actions:moxtralogin');

module.exports = function(router) {
  var formio = router.formio;
  var Action = formio.Action;
  var hook = formio.hook;
  var util = formio.util;

  /**
   * AuthAction class.
   *   This class is used to create the Authentication action.
   *
   * @constructor
   */
  var MoxtraLogin = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  // Derive from Action.
  MoxtraLogin.prototype = Object.create(Action.prototype);
  MoxtraLogin.prototype.constructor = MoxtraLogin;
  MoxtraLogin.info = function(req, res, next) {
    next(null, {
      name: 'moxtraLogin',
      title: 'Moxtra Login',
      description: 'Provides a way to Login to Moxtra.',
      priority: -10,
      defaults: {
        handler: ['after'],
        method: ['create']
      },
      access: {
        handler: false,
        method: false
      }
    });
  };

  /**
   * Settings form for auth action.
   *
   * @param req
   * @param res
   * @param next
   */
  MoxtraLogin.settingsForm = function(req, res, next) {
    var basePath = hook.alter('path', '/form', req);
    var dataSrc = basePath + '/{{ data.resource }}/components';
    next(null, [
      {
        type: 'select',
        input: true,
        label: 'Resource',
        key: 'resource',
        placeholder: 'Select the resource we should login against.',
        dataSrc: 'url',
        data: {url: basePath + '?type=resource'},
        valueProperty: '_id',
        template: '<span>{{ item.title }}</span>',
        multiple: false,
        validate: {
          required: true
        }
      },
      {
        type: 'select',
        input: true,
        label: 'First name Field',
        key: 'firstname',
        placeholder: 'Select the first name field',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false,
        validate: {
          required: true
        },
        clearOnRefresh: false,
        refreshOn: 'resource'
      },
      {
        type: 'select',
        input: true,
        label: 'Last name Field',
        key: 'lastname',
        placeholder: 'Select the last name field',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false,
        validate: {
          required: true
        },
        clearOnRefresh: false,
        refreshOn: 'resource'
      }
    ]);
  };

  /**
   * Authenticate with Moxtra using their sso method.
   *
   * Note: Requires req.body to contain the firstname and lastname.
   *
   * @param handler
   * @param method
   * @param req {Object}
   *   The Express request object.
   * @param res {Object}
   *   The Express response object.
   * @param next {Function}
   *   The callback function to execute upon completion.
   */
  MoxtraLogin.prototype.resolve = function(handler, method, req, res, next) {
    if (!_.has(res, 'resource.item')) {
      return next('No resource was loaded for authentication.');
    }

    // Grab the user obj.
    var user;
    try {
      user = res.resource.item.toObject();
    }
    catch (e) {
      user = res.resource.item;
    }

    if (!user || !_.has(user, 'data')) {
      return next('Could not load the current user.');
    }

    // Check for the require action settings.
    var errors = [];
    ['firstname', 'lastname'].forEach(function(item) {
      if (!_.has(this.settings, item)) {
        errors.push(item);
      }
    }.bind(this));
    if (errors.length !== 0) {
      return next('The Moxtra project settings are incomplete. Missing: ' + errors.join(', '));
    }

    // They must provide a firstname.
    if (!_.has(user.data, this.settings.firstname)) {
      return next('First name not provided.');
    }

    // They must provide a lastname.
    if (!_.has(user.data, this.settings.lastname)) {
      return next('Last name not provided.');
    }

    /**
     * Wrap the project settings request in a promise.
     *
     * @returns {*|promise}
     */
    var getProjectSettings = function() {
      var deferred = Q.defer();

      hook.settings(req, function(err, settings) {
        if (err) {
          return deferred.reject(err);
        }

        return deferred.resolve(settings);
      });

      return deferred.promise;
    };

    /**
     * Get the auth token for a moxtra user.
     *
     * @param user
     * @param firstname
     * @param lastname
     * @returns {*|promise}
     */
    var getMoxtraToken = function(user, firstname, lastname) {
      var deferred = Q.defer();

      getProjectSettings().then(function(settings) {
        if (!_.has(settings, 'moxtra.clientId')) {
          return deferred.reject('No Moxtra clientId found in the project settings.');
        }

        if (!_.has(settings, 'moxtra.clientSecret')) {
          return deferred.reject('No Moxtra clientSecret found in the project settings.');
        }

        if (!_.has(settings, 'moxtra.environment')) {
          return deferred.reject('No Moxtra environment found in the project settings.');
        }

        var body = {
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

        // Add the orgId if present in the settings.
        if (_.has(settings, 'moxtra.orgId')) {
          body.data.orgid = _.get(settings, 'moxtra.orgId');
        }

        rest.post(_.get(settings, 'moxtra.environment'), body)
        .on('complete', function(result) {
          debug(result);
          if (result instanceof Error) {
            return deferred.reject(result);
          }
          if (!_.has(result, 'access_token')) {
            return deferred.reject('No access token given.');
          }

          return deferred.resolve(result.access_token);
        });
      });

      return deferred.promise;
    };

    var updateUsersToken = function(token) {
      var deferred = Q.defer();

      // We have to manually manage the externalId upsert, because $ doesnt work with upsert.
      formio.resources.submission.model.find({_id: util.idToBson(user._id)}, function(err, user) {
        if (err || !user || (user && user.length !== 1)) {
          return deferred.reject('Could not load the user.');
        }

        var external = user.externalIds || [];
        external = _.reject(external, {type: 'moxtra'});
        external.push({
          type: 'moxtra',
          id: token
        });

        user = user.pop();
        user.set('externalIds', external);
        user.save(function(err, user) {
          if (err) {
            return deferred.reject('Could not save the user.');
          }

          res.resource.item = user;
          return deferred.resolve('The users access token has been updated for moxtra.');
        });
      });

      return deferred.promise;
    };

    // Perform an authentication if the user is defined.
    if (!user) {
      return next();
    }

    // If the user was supplied (just created, make the user in moxtra).
    getMoxtraToken(user, this.settings.firstname, this.settings.lastname)
    .then(function(token) {
      return updateUsersToken(token);
    })
    .then(function(response) {
      return next(null, response);
    })
    .catch(function(err) {
      return next(err);
    });
  };

  // Return the MoxtraLogin.
  return MoxtraLogin;
};
