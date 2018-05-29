'use strict';

var _ = require('lodash');
var Twilio = require('twilio');
var debug = require('debug')('formio:action:twilioSMS');

module.exports = function(router) {
  var Action = router.formio.Action;
  var formio = router.formio;

  /**
   * TwilioSMS class.
   *   This class is used to integrate with Twilio SMS.
   *
   * @constructor
   */
  var TwilioSMS = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  TwilioSMS.prototype = Object.create(Action.prototype);
  TwilioSMS.prototype.constructor = TwilioSMS;
  TwilioSMS.info = function(req, res, next) {
    next(null, {
      name: 'twilioSMS',
      title: 'Twilio SMS (Premium)',
      premium: true,
      description: 'Allows you to send SMS to phone numbers.',
      priority: 0,
      defaults: {
        handler: ['after'],
        method: ['create']
      }
    });
  };
  TwilioSMS.settingsForm = function(req, res, next) {
    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug(err);
        return next(null, {});
      }

      settings = settings || {};
      if (!settings.twilio) {
        return res.status(400).send('No project settings were found for the Twilio.');
      }

      var missingSetting = _.find(['accountSid', 'authToken'], function(prop) {
        return !settings.twilio[prop];
      });
      if (missingSetting) {
        debug(missingSetting);
        return res.status(400).send('The Twilio is missing required settings.');
      }

      var form = [
        {
          input: true,
          label: 'From:',
          key: 'from',
          placeholder: 'Choose phone number from which send SMS.',
          dataSrc: 'values',
          template: '<span>{{ item.label }}</span>',
          data: {
            values: []
          },
          validate: {
            required: true
          },
          type: 'select'
        },
        {
          input: true,
          inputType: 'text',
          label: 'To:',
          key: 'to',
          placeholder: 'Enter phone number to which send SMS.',
          validate: {
            required: true
          },
          type: 'textfield'
        },
        {
          input: true,
          label: 'Message',
          key: 'message',
          placeholder: 'Enter SMS.',
          validate: {
            required: true
          },
          type: 'textarea'
        }
      ];

      var accountSid = settings.twilio.accountSid;
      var authToken = settings.twilio.authToken;

      var client = new Twilio(accountSid, authToken);
      client.incomingPhoneNumbers.list()
        .then(function(phoneNumbers) {
          form[0].data.values = phoneNumbers.map(function(phoneNumber) {
            return {
              value: phoneNumber.phoneNumber,
              label: phoneNumber.friendlyName
            };
          });
          next(null, form);
        });
    });
  };
  TwilioSMS.prototype.resolve = function(handler, method, req, res, next) {
    function handleErrors(err) {
      debug(err);
      return next(err);
    }

    var settings = this.settings;

    var cache = require('../../cache/cache')(formio);
    var project = cache.currentProject(req);
    if (project === null || project === undefined) {
      return handleErrors('No project found.');
    }

    var from = settings.from;
    var to = settings.to;
    var message = settings.message;

    var accountSid = _.get(project, 'settings.twilio.accountSid');
    var authToken = _.get(project, 'settings.twilio.authToken');

    var client = new Twilio(accountSid, authToken);
    client.messages.create({
      from: from,
      to: to,
      body: message
    })
      .then(function(response) {
        debug(response);
        return next(null, response);
      })
      .catch(handleErrors);
  };

  // Return the TwilioSMS.
  return TwilioSMS;
};
