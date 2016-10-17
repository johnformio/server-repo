'use strict';

var _ = require('lodash');
var debug = {
  settingsForm: require('debug')('formio:actions:GroupAction#settingsForm')
};

module.exports = function(router) {
  var Action = router.formio.Action;
  var hook = router.formio.hook;

  /**
   * GroupAction class.
   *   This class is used to create the Role action.
   *
   * @constructor
   */
  var GroupAction = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  // Derive from Action.
  GroupAction.prototype = Object.create(Action.prototype);
  GroupAction.prototype.constructor = GroupAction;
  GroupAction.info = function(req, res, next) {
    next(null, {
      name: 'group',
      title: 'Group Assignment (Premium)',
      premium: true,
      description: 'Provides the Group Assignment capabilities.',
      priority: 1,
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
  GroupAction.settingsForm = function(req, res, next) {
    var basePath = hook.alter('path', '/form', req);
    var dataSrc = basePath + '/' + req.params.formId + '/components';
    next(null, [
      {
        type: 'select',
        input: true,
        label: 'Group Resource',
        key: 'group',
        placeholder: 'Select the Group Resource field',
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
        label: 'User Resource',
        key: 'user',
        placeholder: 'self',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false,
        validate: {
          required: false
        }
      }
    ]);
  };

  /**
   * Add the group roles to the user.
   *
   * @param handler
   *   TODO
   * @param method
   *   TODO
   * @param req
   *   The Express request object.
   * @param res
   *   The Express response object.
   * @param next
   *   The callback function to execute upon completion.
   */
  GroupAction.prototype.resolve = function(handler, method, req, res, next) {

  };

  // Return the GroupAction.
  return GroupAction;
};
