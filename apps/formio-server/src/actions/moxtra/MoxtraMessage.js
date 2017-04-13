'use strict';

let rest = require('restler');
let _ = require('lodash');
let debug = require('debug')('formio:actions:moxtramessage');

module.exports = function(router) {
  let formio = router.formio;
  let Action = formio.Action;
  let hook = formio.hook;
  let util = formio.util;
  let Moxtra = require('./utils')(router);

  /**
   * AuthAction class.
   *   This class is used to create the Authentication action.
   *
   * @constructor
   */
  var MoxtraMessage = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  // Derive from Action.
  MoxtraMessage.prototype = Object.create(Action.prototype);
  MoxtraMessage.prototype.constructor = MoxtraMessage;
  MoxtraMessage.info = function(req, res, next) {
    next(null, {
      name: 'moxtraMessage',
      title: 'Moxtra Message',
      description: 'Provides a way to Create new Moxtra Chat Messages',
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
   * Settings form
   *
   * @param req
   * @param res
   * @param next
   */
  MoxtraMessage.settingsForm = function(req, res, next) {
    if (!_.has(req.user.externalIds)) {
      return res.status(400).send(`Could not access user token.`);
    }
    let userToken = _.filter(req.user.externalIds, {type: `moxtra`});
    if (!userToken) {
      return res.status(400).send(`Moxtra token not found for the current user.`)
    }
    
    Moxtra.getToken(req, req.user)
    .then(token => {
      return Moxtra.getBinder(req, token);
    })
    .then(binders => {
      console.log(binders);
      return next(null, []);
    })
    .catch(err => {
      return next(err.message || err);
    });
  };

  /**
   *
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
  MoxtraMessage.prototype.resolve = function(handler, method, req, res, next) {

  };

  // Return the MoxtraMessage.
  return MoxtraMessage;
};
