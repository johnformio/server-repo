'use strict';

var _ = require('lodash');
var util = require('./util');
var debug = require('debug')('formio:action:hubspot');

module.exports = function(router) {
  /**
   * HubspotContactAction class.
   *   This class is used to create the Hubspot Contact action.
   *
   * @constructor
   */
  var HubspotContactAction = function(data, req, res) {
    router.formio.Action.call(this, data, req, res);
  };

  // Derive from Action.
  HubspotContactAction.prototype = Object.create(router.formio.Action.prototype);
  HubspotContactAction.prototype.constructor = HubspotContactAction;
  HubspotContactAction.info = function(req, res, next) {
    next(null, {
      name: 'hubspotContact',
      title: 'Hubspot Contact (Premium)',
      description: 'Allows you to change contact fields in hubspot.',
      premium: true,
      priority: 0,
      defaults: {
        handler: ['after'],
        method: ['create']
      }
    });
  };

  HubspotContactAction.settingsForm = function(req, res, next) {
    util.connect(router, req, function(err, hubspot) {
      if (err) {
        debug('hubspot connect err: ' + (err.message || err));
        return next(err.message || err);
      }

      // Create the panel for all the fields.
      var fieldPanel = {
        type: 'panel',
        theme: 'info',
        title: 'Hubspot Fields',
        input: false,
        components: []
      };

      hubspot.contacts_properties({version: 'v2'}, function(err, properties) {
        if (err) {
          var message = err.message || err;
          var apiKeyError = /Hubspot API error response: This hapikey \(.*\) doesn't exist!/i;

          if (apiKeyError.test(message)) {
            message = 'The configured HubSpot API key is not valid, please update it before continuing.';
          }

          debug('hubspot contacts_properties err: ' + message);
          return next(message);
        }

        var fieldSrc = router.formio.hook.alter('url', '/form/' + req.params.formId + '/components', req);
        var filteredProperties = _.filter(_.sortBy(properties, 'label'), function(property) {
          return !property.readOnlyValue && !property.hidden;
        });

        // Create the select items for each hubspot field.
        var optionsSrc = [
          {
            label: 'No mapping',
            value: ''
          },
          {
            label: 'Map to a form field',
            value: 'field'
          },
          {
            label: 'Set to static or rendered value',
            value: 'value'
          },
          {
            label: 'Increment a number',
            value: 'increment'
          },
          {
            label: 'Decrement a number',
            value: 'decrement'
          },
          {
            label: 'Set to current datetime',
            value: 'currentdt'
          }
        ];
        _.each(filteredProperties, function(field) {
          var fieldOptions = {
            type: 'fieldset',
            legend: field.label + ' Field',
            input: false,
            components: [
              {
                type: 'columns',
                input: false,
                columns: [
                  {
                    components: [
                      {
                        type: 'select',
                        key: field.name + '_action',
                        label: 'Action',
                        input: true,
                        placeholder: 'Select an action to change',
                        template: '<span>{{ item.label || item.value }}</span>',
                        dataSrc: 'values',
                        data: {values: optionsSrc},
                        valueProperty: '',
                        multiple: false
                      }
                    ]
                  },
                  {
                    components: [
                      {
                        type: 'textfield',
                        key: field.name + '_value',
                        label: 'Value',
                        input: true,
                        multiple: false
                      },
                      {
                        type: 'select',
                        key: field.name + '_field',
                        label: 'Field',
                        input: true,
                        placeholder: 'Select the field for ' + field.label,
                        template: '<span>{{ item.label || item.key }}</span>',
                        dataSrc: 'url',
                        data: {url: fieldSrc},
                        valueProperty: 'key',
                        multiple: false
                      }
                    ]
                  }
                ]
              }
            ]
          };

          fieldPanel.components.push(fieldOptions);
        });

        next(null, [fieldPanel]);
      });
    });
  };

  /**
   * Execute the action.
   *
   * @param handler
   * @param method
   * @param req
   *   The Express request object.
   * @param res
   *   The Express response object.
   * @param next
   *   The callback function to execute upon completion.
   */
  HubspotContactAction.prototype.resolve = function(handler, method, req, res, next) {
    var actionInfo = this;

    // Dont block on the hubspot request.
    /* eslint-disable */
    next();
    /* eslint-enable */

    util.connect(router, req, function(err, hubspot) {
      if (err) {
        debug(err);
        return;
      }

      // Store the current resource.
      var currentResource = res.resource;

      // Limit to _action fields with a value set.
      var fields = _.pick(actionInfo.settings, function(value, key) {
        return value && _.endsWith(key, '_action');
      });

      // Remove _action from the field names so we can map everything out.
      fields = _.mapKeys(fields, function(value, key) {
        return key.substring(0, key.length - 7);
      });

      var getContactById = function(vid, done) {
        debug('vid: ' + vid);
        hubspot.contacts_contact_by_id({vid: vid}, function(err, result) {
          if (err) {
            return done(err);
          }

          debug(result);
          done(null, result);
        });
      };

      var createOrUpdate = function(email, user, done) {
        debug('searching for ' + email);
        hubspot.contacts_create_update({email: email}, function(err, result) {
          if (err) {
            return done(err);
          }

          debug(result);
          if (user) {
            // Save off the vid to the user's account.
            router.formio.resources.submission.model.update({
              _id: user._id
            }, {
              $push: {
                // Add the external ids
                externalIds: {
                  type: 'hubspotContact',
                  id: result.vid
                }
              }
            }, function(err, result) {
              if (err) {
                debug(err);
                return;
              }
            });
          }
          done(null, result.vid);
        });
      };

      var processField = function(action, key, value, current) {
        switch (action) {
          case 'field':
            return req.body.data[value];
          case 'value':
            return router.formio.nunjucks.render(value, currentResource);
          case 'increment':
            value = parseInt(value) || 1;
            current = parseInt(current) || 0;
            return current + value;
          case 'decrement':
            value = parseInt(value) || 1;
            current = parseInt(current) || 0;
            return current - value;
          case 'currentdt':
            return Date.now();
        }
      };

      var updateContact = function(contact) {
        /* eslint-disable */
        var payload = {
          contact_id: contact.vid,
          properties: {}
        };
        /* eslint-enable */

        _.each(fields, function(action, key) {
          var extension = (action === 'field' ? '_field' : '_value');
          var current = contact.properties.hasOwnProperty(key) ? contact.properties[key].value : null;
          payload.properties[key] = processField(action, key, actionInfo.settings[key + extension], current);
        });

        debug(payload);
        hubspot.contacts_properties_update(payload, function(err) {
          if (err) {
            debug(err);
            return;
          }
        });
      };

      if (!req.token) {
        return;
      }
      router.formio.cache.loadSubmission(req, req.token.form._id, req.token.user._id, function(err, user) {
        if (err) {
          return debug(err);
        }

        var email, externalId;
        // First check for an email field in mappings.
        _.each(fields, function(value, key) {
          if (key === 'email') {
            email = processField(value, key, actionInfo.settings[key + '_' + value], '');
          }
        });

        // If email field is not mapped, use the current user.
        if (!email && user) {
          externalId = _.result(_.find(user.externalIds, {type: 'hubspotContact'}), 'id');
          // We are assuming an email field here which may not be the case with other projects.
          if (!externalId && user.data.hasOwnProperty('email')) {
            email = user.data.email;
          }
        }

        // if no user, don't do anything as we can't identify them.
        if (!externalId && !email) {
          return debug('no identifier found');
        }

        if (externalId) {
          debug('externalId: ' + externalId);
          getContactById(externalId, function(err, contact) {
            if (err) {
              return debug(err);
            }

            updateContact(contact);
          });
        }
        else if (email) {
          debug('email: ' + email);
          createOrUpdate(email, user, function(err, contactId) {
            if (err) {
              return debug(err);
            }

            getContactById(contactId, function(err, contact) {
              if (err) {
                return debug(err);
              }

              updateContact(contact);
            });
          });
        }
      });
    });
  };

  return HubspotContactAction;
};
