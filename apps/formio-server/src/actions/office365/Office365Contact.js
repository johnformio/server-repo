'use strict';

const _ = require('lodash');

module.exports = function(router) {
  const util = require('./util')(router);
  const {
    Action,
    hook
  } = router.formio;

  // The available fields.
  const office365Fields = {
    AssistantName: {
      title: 'Assistant Name',
      type: 'string'
    },
    Birthday: {
      title: 'Birthday',
      type: 'datetime'
    },
    BusinessAddress: {
      title: 'Business Address',
      type: 'address'
    },
    BusinessHomePage: {
      title: 'Business Home Page',
      type: 'string'
    },
    BusinessPhones: {
      title: 'Business Phone Numbers',
      type: 'array[string]'
    },
    Categories: {
      title: 'Categories',
      type: 'array[string]'
    },
    CompanyName: {
      title: 'Company',
      type: 'string'
    },
    Department: {
      title: 'Department',
      type: 'string'
    },
    DisplayName: {
      title: 'Display Name',
      type: 'string'
    },
    EmailAddresses: {
      title: 'Email Address',
      type: 'array[email]'
    },
    FileAs: {
      title: 'File As',
      type: 'string'
    },
    Generation: {
      title: 'Generation',
      type: 'string'
    },
    GivenName: {
      title: 'First Name',
      type: 'string'
    },
    HomeAddress: {
      title: 'Home Address',
      type: 'address'
    },
    HomePhones: {
      title: 'Home Phone Number',
      type: 'array[string]'
    },
    ImAddresses: {
      title: 'IM Address',
      type: 'array[string]'
    },
    Initials: {
      title: 'Initials',
      type: 'string'
    },
    JobTitle: {
      title: 'Job Title',
      type: 'string'
    },
    Manager: {
      title: 'Manager',
      type: 'string'
    },
    MiddleName: {
      title: 'Middle Name',
      type: 'string'
    },
    MobilePhone1: {
      title: 'Mobile Phone Number',
      type: 'string'
    },
    NickName: {
      title: 'Nick Name',
      type: 'string'
    },
    OfficeLocation: {
      title: 'Office Location',
      type: 'string'
    },
    OtherAddress: {
      title: 'Other Address',
      type: 'address'
    },
    Profession: {
      title: 'Profession',
      type: 'string'
    },
    Surname: {
      title: 'Last Name',
      type: 'string'
    },
    Title: {
      title: 'Title',
      type: 'string'
    }
  };

  /**
   * Office365ContactAction class.
   *   This class is used to create the Office 365 Contact action.
   */
  class Office365ContactAction extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'office365contact',
        title: 'Office 365 Contacts',
        description: 'Allows you to integrate into your Office 365 Contacts.',
        priority: 0,
        defaults: {
          handler: ['after'],
          method: ['create', 'update', 'delete']
        }
      }));
    }

    static settingsForm(req, res, next) {
      // Create the panel for all the fields.
      const fieldPanel = {
        type: 'panel',
        theme: 'info',
        title: 'Office 365 Fields',
        input: false,
        components: []
      };

      // Create the select items for each office 365 field.
      const dataSrc = router.formio.hook.alter('path', `/form/${req.params.formId}/components`, req);
      _.each(office365Fields, function(field, fieldKey) {
        fieldPanel.components.push({
          type: 'select',
          input: true,
          label: `${field.title} Field`,
          key: fieldKey,
          placeholder: `Select the ${field.title} field`,
          template: '<span>{{ item.label || item.key }}</span>',
          dataSrc: 'url',
          data: {url: dataSrc},
          valueProperty: 'key',
          multiple: false
        });
      });

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
        fieldPanel
      ]);
    }

    /**
     * Execute the action.
     *
     * @param handler
     *   todo
     * @param method
     *   todo
     * @param req
     *   The Express request object.
     * @param res
     *   The Express response object.
     * @param next
     *   The callback function to execute upon completion.
     */
    resolve(handler, method, req, res, next) {
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      const payload = {};

      // Skip if there are no settings.
      if (!this.settings) {
        return next();
      }

      // Default authType to 'application'
      const authType = this.settings.authType || 'application';

      // Only add the payload for post and put.
      if (req.method === 'POST' || req.method === 'PUT') {
        // Iterate over all the settings for this action.
        _.each(this.settings, function(formKey, o365Key) {
          // Only continue for fields that are provided in the request.
          if (!req.body.data.hasOwnProperty(formKey)) {
            return;
          }

          // Get the data.
          let data = req.body.data[formKey];

          // Get the data type and normalize it.
          let dataType = office365Fields[o365Key].type;
          const isArray = (dataType.indexOf('array[') === 0);
          dataType = dataType.replace(/^array\[/, '');
          dataType = dataType.replace(/]$/, '');

          // Parse the data.
          if (dataType === 'address') {
            data = util.getAddress(data);
          }

          if (dataType === 'email') {
            data = util.getEmail(data);
          }

          // Convert the data to an array if necessary.
          if (isArray && !_.isArray(data)) {
            data = [data];
          }

          payload[o365Key] = data;
        });
      }

      // Perform the request.
      util.request(router, req, res, 'contacts', 'Office365Contact', authType,  payload);

      // Move onto the next middleware.
      next();
    }
  }

  // Return the Office365ContactAction.
  return Office365ContactAction;
};
