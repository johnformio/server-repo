'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:action:googlesheet');
const GoogleSheet = require('./GoogleSheet');
const CSVExporter = require('formio/src/export').csv;

const util = require('./util');

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
    static async settingsForm(req, res, next) {
      /**
       * Verifying settings form data and restricting action form loading if any of the settings field data is missing.
       */
      try {
        await util.checkOauthParameters(router, req);

        const form = await cache.loadCurrentForm(req);

        if (!form) {
          throw ('No form found.');
        }

        // Create the panel for all the fields.
        const fieldPanel = {
          type: 'panel',
          theme: 'info',
          title: 'Google Sheet Fields',
          input: false,
          components: _.map((new CSVExporter(form, req, res)).fields, (field) => ({
            type: 'textfield',
            input: true,
            label: field.title ? `${field.title} Column (${field.label})` : `${field.label} Column`,
            key: field.label,
            placeholder: 'Enter a Column Key. Example: C',
            multiple: false,
          })),
        };

        return next(null, [
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
          fieldPanel,
          {
            key: 'well',
            type: 'well',
            input: false,
            components: [
              {
                key: "content",
                input: false,
                /* eslint-disable max-len */
                html: '<p>When using several Google Sheets actions you should specify unique <strong>External Id Type</strong> for each to avoid undesirable result.</p>',
                /* eslint-enable max-len */
                type: "content",
                label: "content",
              },
              {
                input: true,
                inputType: "text",
                label: "External Id Type",
                key: "externalIdType",
                multiple: false,
                protected: false,
                unique: false,
                persistent: true,
                type: "textfield",
                description: "The name to store and reference the external Id for this action",
              }
            ]
          }
        ]);
      }
      catch (err) {
          res.status(400).send(err);
      }
    }

    // The actions core execution logic.
    async resolve(handler, method, req, res, next) {
      if (!await hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      if (!this.settings) {
        return debug('No settings for google sheets action.');
      }

      // No feedback needed directly. Call next immediately.
      next(); // eslint-disable-line callback-return

      // Load the project settings.
      try {
        const settings = await hook.settings(req);

        const config = {
          client_id: _.get(settings, 'google.clientId'), // eslint-disable-line camelcase
          client_secret: _.get(settings, 'google.cskey'), // eslint-disable-line camelcase
          refresh_token: _.get(settings, 'google.refreshtoken') // eslint-disable-line camelcase
        };
        const spreadSheet = new GoogleSheet();
        const type = this.settings.externalIdType || this.name;
        let request = null;
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          const item = _.get(res, 'resource.item');

          // Set method for the googledrive files to write a link
          req.googleSheetAction = (file, defaultValue) => {
            if (file && file.storage === 'googledrive' && file.originalUrl) {
              return file.originalUrl;
            }

            return defaultValue;
          };

          const data = new CSVExporter(req.currentForm, req, res)
            .getSubmissionData(item)
            .updatedSubmission;

            // Remove a method for googledrive files
            req.googleSheetAction = null;

          const rowId = this.getRowId(item, type);

          request = (rowId
            ? spreadSheet.updateRow(config, this.settings, rowId, data)
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
                        id: result.rowId,
                        type,
                      }
                    }
                  }
                ).exec();
              }));
        }
        else if (req.method === 'DELETE') {
          // Only proceed with deleting a row, if applicable to this request.
          const deleted = _.get(req, `formioCache.submissions.${_.get(req, 'subId')}`);
          if (!deleted) {
            return;
          }

          // The row number to delete.
          const rowId = this.getRowId(deleted, type);
          if (!rowId) {
            return;
          }

          request = spreadSheet.deleteRow(config, this.settings, rowId);
        }
        if (request) {
          request.catch((err) => debug(err.message || err));
        }
      }
      catch (err) {
        debug(err);
        return;
      }
    }

    getRowId(item, type) {
      const externalIds = _.get(item, 'externalIds');

      if (!externalIds) {
        return null;
      }

      // The row number to update.
      const rowId = _.get(externalIds.find((item) => item.type === type), 'id');
      if (!rowId) {
        return null;
      }

      return rowId;
    }
  }

  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
