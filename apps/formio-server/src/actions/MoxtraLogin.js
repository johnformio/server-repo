'use strict';

var _ = require('lodash');

module.exports = function(router) {
  var Action = router.formio.Action;
  var hook = router.formio.hook;

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
      priority: 15,
      defaults: {
        handler: ['before'],
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
    var dataSrc = basePath + '/' + req.params.formId + '/components';
    next(null, [
      {
        type: 'select',
        input: true,
        label: 'Username Field',
        key: 'username',
        placeholder: 'Select the username field',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
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
        }
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
        }
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
    if (!req.submission || !req.submission.hasOwnProperty('data')) {
      return next('Submission data is required to Authenticate.');
    }

    // They must provide a username.
    if (!_.has(req.submission.data, this.settings.username)) {
      return next('Username not provided.');
    }

    // They must provide a firstname.
    if (!_.has(req.submission.data, this.settings.firstname)) {
      return next('First name not provided.');
    }

    // They must provide a lastname.
    if (!_.has(req.submission.data, this.settings.lastname)) {
      return next('Last name not provided.');
    }

    // Perform an authentication.
    // TODO
  };

  // Return the MoxtraLogin.
  return MoxtraLogin;
};
