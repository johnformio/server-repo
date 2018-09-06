'use strict';

const _ = require('lodash');
const util = require('./util');
const formioUtil = require('formio/src/util/util');
const debug = require('debug')('formio:action:googlesheet');
const GoogleSheet = require('formio-services/services/GoogleSheet');

module.exports = (router) => {
  const {
    formio: {
      Action,
      cache,
      resources,
      hook
    }
  } = router;

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
      util.checkOauthParameters(router, req)
        .then(() => new Promise((resolve, reject) => {
          cache.loadCurrentForm(req, (err, form) => {
            if (err) {
              return reject(err);
            }

            if (!form) {
              return reject('No form found.');
            }

            // Create the panel for all the fields.
            const fieldPanel = {
              type: 'panel',
              theme: 'info',
              title: 'Google Sheet Fields',
              input: false,
              components: []
            };

            formioUtil.eachComponent(form.components, (component) => {
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
                tooltip: 'Enter the Sheet ID',
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
                tooltip: 'Enter the Worksheet Name. Example: Sheet1',
                input: true,
                validate: {
                  required: true
                },
                multiple: false
              },
              {
                type: 'textfield',
                label: 'Start Row',
                placeholder: 'The first row of the data in your spreadsheet.',
                tooltip: 'The first row of the data in your spreadsheet.',
                key: 'spreadSheetStartRow',
                defaultValue: '2',
                input: true
              },
              fieldPanel
            ]);
          });
        }))
        .catch((err) => res.status(400).send(err));
    }

    // The actions core execution logic.
    resolve(handler, method, req, res, next) {
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      // No feedback needed directly. Call next immediately.
      next(); // eslint-disable-line callback-return

      // Load the project settings.
      hook.settings(req, (err, settings) => {
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
        if (['POST', 'PUT'].includes(req.method)) {
          const item = _.get(res, 'resource.item');
          const rowId = this.getRowId(item);

          return (rowId
            ? spreadSheet.updateRow(config, this.settings, rowId, item.data)
            : spreadSheet.addRow(config, this.settings, data)
              .then((result) => {
                if (!res.resource) {
                  return debug('No resource given in the response.');
                }

                // Update the formio submission with an externalId ref to the sheet.
                return resources.submission.model.findByIdAndUpdate(
                  res.resource.item._id,
                  {
                    $push: {
                      externalIds: {
                        type: this.name,
                        id: result.rowId
                      }
                    }
                  }
                ).exec();
              }))
            .catch((err) => debug(err.message || err));
        }
        else if (req.method === 'DELETE') {
          // Only proceed with deleting a row, if applicable to this request.
          const deleted = _.get(req, `formioCache.submissions.${_.get(req, 'subId')}`);
          if (!deleted) {
            return;
          }

          // The row number to delete.
          const rowId = _.get(deleted.externalIds.find((item) => item.type === this.name), 'id');
          if (!rowId) {
            return;
          }

          spreadSheet.deleteRow(config, this.settings, rowId)
            .catch(err => debug(err.message || err));
        }
      });
    }

    getRowId(item) {
      const externalIds = _.get(item, 'externalIds');

      if (!externalIds) {
        return null;
      }

      // The row number to update.
      const rowId = _.get(externalIds.find((item) => item.type === this.name), 'id');
      if (!rowId) {
        return null;
      }

      return rowId;
    }
  }

  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
