'use strict';

var Q = require('q');
var _ = require('lodash');
var debug = require('debug')('formio:actions:moxtralogin');

module.exports = function(router) {
  var formio = router.formio;
  var Action = formio.Action;
  var hook = formio.hook;
  var util = formio.util;
  let Moxtra = require('./utils')(router);

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
        method: ['create', 'delete']
      },
      access: {
        handler: false,
        method: false
      }
    });
  };
  MoxtraLogin.access = {
    handler: false,
    method: false
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
    if (method === 'delete') {
      // If the current project does not have any orgId, dont worry about deleting the user. There is no moxtra support.
      if (!_.has(req.currentProject, 'settings.moxtra.orgId')) {
        return next();
      }

      let orgId = _.get(req.currentProject, 'settings.moxtra.orgId');
      return Moxtra.getToken(req, req.user)
      .then(token => Moxtra.removeUserFromOrg(req, orgId, req.subId, token))
      .then(results => {
        // Ignore the moxtra results.
        debug(results);
        return next();
      })
      .catch(e => {
        debug(e);
        return next();
      });
    }

    if (!_.has(res, 'resource.item')) {
      return res.status(400).send('No resource was loaded for authentication.');
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
      return res.status(400).send('Could not load the current user.');
    }

    // Check for the require action settings.
    var errors = [];
    ['firstname', 'lastname'].forEach(function(item) {
      if (!_.has(this.settings, item)) {
        errors.push(item);
      }
    }.bind(this));
    if (errors.length !== 0) {
      return res.status(400).send('The Moxtra project settings are incomplete. Missing: ' + errors.join(', '));
    }

    // They must provide a firstname.
    if (!_.has(user.data, this.settings.firstname)) {
      return res.status(400).send('First name not provided.');
    }

    // They must provide a lastname.
    if (!_.has(user.data, this.settings.lastname)) {
      return res.status(400).send('Last name not provided.');
    }

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
    Moxtra.getToken(req, user, this.settings.firstname, this.settings.lastname)
    .then(function(token) {
      return updateUsersToken(token);
    })
    .then(function(response) {
      debug(response);
      return next(null, response);
    })
    .catch(function(err) {
      debug(err);
      return next(err);
    });
  };

  // Return the MoxtraLogin.
  return MoxtraLogin;
};
