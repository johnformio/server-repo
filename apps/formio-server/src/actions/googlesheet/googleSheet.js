'use strict';

const _ = require('lodash');
const util = require('./util');
const formioUtil = require('formio/src/util/util');
const debug = require('debug')('formio:action:googlesheet');
const GoogleSheet = require('formio-services/services/GoogleSheet');

module.exports = function(router) {
  const {formio} = router;
  const {
    Action,
    hook
  } = formio;

  /**
   * GoogleSheetAction class.
   *  This class is used to create the Google Sheet action.
   */
  class GoogleSheetAction extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'googlesheet',
        title: 'Google Sheets',
        description: 'Allows you to integrate data into Google sheets.',
        priority: 0,
        defaults: {
          handler: ['after'],
          method: ['create', 'update', 'delete']
        }
      }));
    }

    // The actions settings form.
    static settingsForm(req, res, next) {
      /**
       * Verifying settings form data and restricting action form loading if any of the settings field data is missing.
       */
      util.checkOauthParameters(router, req, function(err) {
        if (err) {
          return res.status(400).send(err);
        }

        formio.cache.loadCurrentForm(req, (err, form) => {
          if (err) {
            return res.status(400).send(err);
          }

          if (!form) {
            return res.status(400).send('No form found.');
          }

          // Create the panel for all the fields.
          const fieldPanel = {
            type: 'panel',
            theme: 'info',
            title: 'Google Sheet Fields',
            input: false,
            components: []
          };

          formioUtil.eachComponent(form.components, function(component) {
            if (component.action !== 'submit' && component.input) {
              fieldPanel.components.push({
                type: 'textfield',
                input: true,
                label: `${component.label || component.key} Column`,
                key: component.key,
                placeholder: 'Enter a Column Key. Example: C',
                multiple: false
              });
            }
          }, true);

          next(null, [
            {
              type: 'textfield',
              label: 'Sheet ID',
              key: 'sheetID',
              placeholder: 'Enter the Sheet ID',
              input: true,
              validate: {
                required: true
              },
              multiple: false
            },
            {
              type: 'textfield',
              label: 'Worksheet Name',
              key: 'worksheetName',
              placeholder: 'Enter the Worksheet Name. Example: Sheet1',
              input: true,
              validate: {
                required: true
              },
              multiple: false
            },
            fieldPanel
          ]);
        });
      });
    }

    // The actions core execution logic.
    resolve(handler, method, req, res, next) {
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      // No feedback needed directly. Call next immediately.
      next(); // eslint-disable-line callback-return

      // Load the project settings.
      formio.hook.settings(req, (err, settings) => {
        const data = _.get(req, 'body.data');
        if (err) {
          debug(err);
          return;
        }

        const config = {
          client_id: _.get(settings, 'google.clientId'), // eslint-disable-line camelcase
          client_secret: _.get(settings, 'google.cskey'), // eslint-disable-line camelcase
          refresh_token: _.get(settings, 'google.refreshtoken') // eslint-disable-line camelcase
        };
        const spreadSheet = new GoogleSheet({
          service: process.env.GOOGLE_SHEETS_SERVICE || ''
        });
        if (req.method === 'POST') {
          spreadSheet.addRow(config, this.settings, data).then((result) => {
            if (!res.resource) {
              return debug('No resource given in the response.');
            }

            // Update the formio submission with an externalId ref to the sheet.
            formio.resources.submission.model.update(
              {_id: res.resource.item._id},
              {
                $push: {
                  externalIds: {
                    type: this.name,
                    id: result.rowId
                  }
                }
              },
              (err) => {
                if (err) {
                  return debug(err.message || err);
                }
              }
            );
          }).catch(err => {
            return debug(err.message || err);
          });
        }
        else if (req.method === 'PUT') {
          if (!res.resource || !res.resource.item || !res.resource.item.externalIds) {
            return;
          }

          // The row number to update.
          let rowId = _.find(res.resource.item.externalIds, (item) => (item.type === this.name));
          rowId = _.get(rowId, 'id');
          if (!rowId) {
            return;
          }

          // Update the row with data.
          spreadSheet.updateRow(config, this.settings, rowId, res.resource.item.data).catch(err => {
            return debug(err.message || err);
          });
        }
        else if (req.method === 'DELETE') {
          // Only proceed with deleting a row, if applicable to this request.
          const deleted = _.get(req, `formioCache.submissions.${_.get(req, 'subId')}`);
          if (!deleted) {
            return;
          }

          // The row number to delete.
          let rowId = _.find(deleted.externalIds, (item) => (item.type === this.name));
          rowId = _.get(rowId, 'id');
          if (!rowId) {
            return;
          }

          spreadSheet.deleteRow(config, this.settings, rowId).catch(err => {
            return debug(err.message || err);
          });
        }
      });
    }
  }

  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
