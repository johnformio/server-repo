'use strict';
const moment = require('moment');

module.exports = function(router) {
  const util = require('./util')(router);
  const hook = router.formio.hook;

  /**
   * Office365CalendarAction class.
   *   This class is used to create the Office 365 Contact action.
   *
   * @constructor
   */
  const Office365CalendarAction = function(data, req, res) {
    router.formio.Action.call(this, data, req, res);
  };

  // Derive from Action.
  Office365CalendarAction.prototype = Object.create(router.formio.Action.prototype);
  Office365CalendarAction.prototype.constructor = Office365CalendarAction;
  Office365CalendarAction.info = function(req, res, next) {
    next(null, hook.alter('actionInfo', {
      name: 'office365calendar',
      title: 'Office 365 Calendar (Premium)',
      description: 'Allows you to integrate into your Office 365 Calendar.',
      premium: true,
      priority: 0,
      defaults: {
        handler: ['after'],
        method: ['create', 'update', 'delete']
      }
    }));
  };

  Office365CalendarAction.settingsForm = function(req, res, next) {
    // Create the select items for each office 365 field.
    const dataSrc = router.formio.hook.alter('path', `/form/${req.params.formId}/components`, req);

    // The Microsoft Timezones JSON.
    const timeZones = 'https://gist.githubusercontent.com/travist/1c7b4ba5289e38dc3a9e/raw/306d24a1efefcb0d70e8978d7272a575625c1843/timezones.json';

    next(null, [
      {
        type: 'select',
        input: true,
        label: 'Authentication Method',
        key: 'authType',
        placeholder: 'Select the method of authentication to use.',
        template: '<span>{{ item.title }}</span>',
        defaultValue: 'application',
        dataSrc: 'json',
        data: {
          json: JSON.stringify([
            {
              type: 'delegated',
              title: 'OAuth Delegated'
            },
            {
              type: 'application',
              title: 'Application Certificate'
            }
          ])
        },
        valueProperty: 'type',
        multiple: false,
        validate: {
          required: true
        }
      },
      {
        label: 'Subject',
        key: 'subject',
        inputType: 'text',
        defaultValue: '',
        input: true,
        placeholder: 'Event Subject',
        type: 'textfield',
        multiple: false,
        required: true
      },
      {
        label: 'Body',
        key: 'body',
        type: 'textarea',
        defaultValue: '',
        multiple: false,
        rows: 3,
        suffix: '',
        prefix: '',
        placeholder: 'Enter the event body you would like to include.',
        input: true
      },
      {
        label: 'Attendees',
        key: 'attendees',
        defaultValue: '',
        input: true,
        placeholder: 'Include the following attendees',
        prefix: '',
        suffix: '',
        type: 'email',
        multiple: true
      },
      {
        type: 'select',
        input: true,
        label: 'Time Zone',
        key: 'timezone',
        placeholder: 'Select the time zone for the events.',
        template: '<span>{{ item.display }}</span>',
        dataSrc: 'url',
        data: {url: timeZones},
        valueProperty: 'timezone',
        defaultValue: 'Central America Standard Time',
        multiple: false
      },
      {
        type: 'select',
        input: true,
        label: 'Start Time Field',
        key: 'start',
        placeholder: 'Select the start time field',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false
      },
      {
        type: 'select',
        input: true,
        label: 'End Time Field',
        key: 'end',
        placeholder: 'Select the end time field',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false
      },
      {
        type: 'select',
        input: true,
        label: 'Location Field',
        key: 'location',
        placeholder: 'Select the location field',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false
      },
      {
        label: 'Categories',
        key: 'categories',
        inputType: 'text',
        defaultValue: '',
        input: true,
        placeholder: 'Use the following categories',
        prefix: '',
        suffix: '',
        type: 'textfield',
        multiple: true
      },
      {
        label: 'Web Link',
        key: 'weblink',
        inputType: 'text',
        defaultValue: '',
        input: true,
        placeholder: 'The web link to provide for the events created.',
        prefix: '',
        suffix: '',
        type: 'textfield',
        multiple: false
      }
    ]);
  };

  /**
   * Execute the action.
   *
   * @param req
   *   The Express request object.
   * @param res
   *   The Express response object.
   * @param cb
   *   The callback function to execute upon completion.
   */
  Office365CalendarAction.prototype.resolve = function(handler, method, req, res, next) {
    if (!hook.alter('resolve', true, this, handler, method, req, res)) {
      return next();
    }

    let payload = {};

    // Skip if there are no settings.
    if (!this.settings) {
      return next();
    }

    // Default authType to 'application'
    const authType = this.settings.authType || 'application';

    // Only add the payload for post and put.
    if (req.method === 'POST' || req.method === 'PUT') {
      payload = {
        Subject: router.formio.nunjucks.render(this.settings.subject, req.body),
        Body: util.getBody(this.settings.body, req.body),
        Start: req.body.data[this.settings.start],
        StartTimeZone: this.settings.timezone,
        End: req.body.data[this.settings.end],
        EndTimeZone: this.settings.timezone,
        Location: util.getLocation(req.body.data[this.settings.location]),
        Attendees: util.getRecipients(this.settings.attendees, req.body),
        WebLink: router.formio.nunjucks.render(this.settings.weblink, req.body),
        Categories: util.getArray(this.settings.categories, req.body)
      };
    }

    // If there isn't an end set, then make the event an hour long.
    if (!payload.End) {
      const start = moment(payload.Start);
      payload.End = start.add(1, 'h').toISOString();
    }

    // Perform the request.
    util.request(router, req, res, 'events', 'Office365Calendar', authType, payload);

    // Move onto the next middleware.
    next();
  };

  // Return the Office365CalendarAction.
  return Office365CalendarAction;
};
