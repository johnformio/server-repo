'use strict';

const _ = require('lodash');
const util = require('./util');
const formioUtil = require('formio/src/util/util');
const debug = require('debug')('formio:action:googlesheet');
const Spreadsheet = require('edit-google-spreadsheet');
const SpreadsheetColumn = (new (require('spreadsheet-column'))());
const async = require('async');

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

      const actionName = _.get(this, 'name');
      const actionSettings = _.get(this, 'settings');
      const sheetId = _.get(this, 'settings.sheetID');
      const sheetName = _.get(this, 'settings.worksheetName');

      // Load the project settings.
      formio.hook.settings(req, function(err, settings) {
        const requestData = _.get(req, 'body.data');
        if (err) {
          debug(err);
          return;
        }

        // Map each piece of submission data to a column using the custom mapping in the action settings.
        const columnIds = {};
        _.each(requestData, function(value, key) {
          _.each(actionSettings, function(_value, _key) {
            if (_key === key) {
              columnIds[key] = SpreadsheetColumn.fromStr(_value);
            }
          });
        });

        /**
         * Util function to add a row to the given spreadsheet.
         *
         * @param {Object} spreadsheet
         *   A loaded Google Spreadsheet.
         */
        const addRow = function(spreadsheet) {
          try {
            async.waterfall([
              function getAvailableRows(callback) {
                spreadsheet.metadata(function(err, metadata) {
                  if (err) {
                    return callback(err);
                  }

                  const rows = parseInt(_.get(metadata, 'rowCount') || 0);
                  callback(null, rows);
                });
              },
              function getRowCount(rows, callback) {
                spreadsheet.receive({
                  getValues: false
                }, function(err, rowData, info) {
                  if (err) {
                    return callback(err);
                  }

                  // Determine how many rows are filled out currently.
                  const currentRows = (info.nextRow - 1);
                  if (currentRows < rows) {
                    return callback(null, currentRows);
                  }

                  // There are not enough rows left to fill out without deleting data, so add 100 more.
                  spreadsheet.metadata({rowCount: (currentRows + 100)}, function(err) {
                    if (err) {
                      return callback(err);
                    }

                    callback(null, currentRows);
                  });
                });
              },
              function addColumnLabels(rows, callback) {
                // Build a map of pretty display column labels and the columnId
                const columnLabels = {};
                _.each(columnIds, function(value, key) {
                  columnLabels[key] = _.startCase(key);
                });

                // If there are no rows, add the column labels before adding row 1.
                if (rows === 0) {
                  const rowData = {};
                  let column = 1;

                  // Iterate the columns to get the column label and its position.
                  _.each(columnIds, function(value, key) {
                    rowData[value] = {
                      name: [column],
                      val: columnLabels[key]
                    };

                    column += 1;
                  });

                  // Add the columns as row 1, and continue adding data to row 2.
                  spreadsheet.add({1: rowData});
                  rows += 1;
                }

                callback(null, rows);
              },
              function addNewRow(rows, callback) {
                const rowId = rows + 1;

                // Build our new row of the spreadsheet, by iterating each column label.
                const rowData = {};
                _.each(columnIds, function(value, key) {
                  rowData[value] = {
                    name: key,
                    val: _.get(requestData, key)
                  };
                });

                // Finally, add all of the new row data to the spreadsheet.
                const update = {};
                update[rowId] = rowData;
                spreadsheet.add(update);
                spreadsheet.send(function(err) {
                  if (err) {
                    return callback(err);
                  }

                  if (!res.resource) {
                    return callback('No resource given in the response.');
                  }

                  // Update the formio submission with an externalId ref to the sheet.
                  formio.resources.submission.model.update(
                    {_id: res.resource.item._id},
                    {
                      $push: {
                        externalIds: {
                          type: actionName,
                          id: rowId
                        }
                      }
                    },
                    callback
                  );
                });
              }
            ], function(err) {
              if (err) {
                debug(err);
              }

              // Done with sheet integration.
              return;
            });
          }
          catch (err) {
            debug(err);
          }
        };

        /**
         * Util function to update a row in the given spreadsheet.
         *
         * @param {Object} spreadsheet
         *   A loaded Google Spreadsheet.
         */
        const updateRow = function(spreadsheet) {
          try {
            // Only proceed with updating a row, if applicable to this request.
            if (!_.has(res, 'resource.item') || !_.has(res, 'resource.item.externalIds')) {
              return;
            }

            // The row number to update.
            let rowId = _.find(res.resource.item.externalIds, function(item) {
              return item.type === actionName;
            });
            rowId = _.get(rowId, 'id');
            if (!rowId) {
              return;
            }

            // Build our new row of the spreadsheet, by iterating each column label.
            const rowData = {};
            const submission = _.get(res, 'resource.item.data');

            // Iterate the columns to get the column label and its position.
            _.each(columnIds, function(value, key) {
              rowData[value] = {
                name: key,
                val: _.get(submission, key)
              };
            });

            // Finally, add all of the data to the row and commit the changes.
            const update = {};
            update[rowId] = rowData;
            spreadsheet.add(update);
            spreadsheet.send(function(err) {
              if (err) {
                debug(err);
              }

              return;
            });
          }
          catch (err) {
            debug(err);
          }
        };

        /**
         * Util function to delete a row from the given spreadsheet.
         *
         * @param {Object} spreadsheet
         *   A loaded Google Spreadsheet.
         */
        const deleteRow = function(spreadsheet) {
          try {
            // Only proceed with deleting a row, if applicable to this request.
            const deleted = _.get(req, `formioCache.submissions.${_.get(req, 'subId')}`);
            if (!deleted) {
              return;
            }

            // The row number to delete.
            let rowId = _.find(deleted.externalIds, function(item) {
              return item.type === actionName;
            });
            rowId = _.get(rowId, 'id');
            if (!rowId) {
              return;
            }

            // Build our blank row of data, by iterating each column label.
            const rowData = [];

            // Get the number of fields from the action settings; subtract 2 for the sheetId and worksheet name.
            const fields = ((Object.keys(actionSettings)).length - 2) || 0;
            for (let a = 0; a < fields; a++) {
              rowData.push('');
            }

            // Finally, update our determined row with empty data.
            const update = {};
            update[rowId] = rowData;
            spreadsheet.add(update);
            spreadsheet.send(function(err) {
              if (err) {
                debug(err);
              }

              return;
            });
          }
          catch (err) {
            debug(err);
          }
        };

        try {
          Spreadsheet.load({
            debug: true,
            oauth2: {
              client_id: _.get(settings, 'google.clientId'), // eslint-disable-line camelcase
              client_secret: _.get(settings, 'google.cskey'), // eslint-disable-line camelcase
              refresh_token: _.get(settings, 'google.refreshtoken') // eslint-disable-line camelcase
            },
            spreadsheetId: sheetId,
            worksheetName: sheetName
          }, function run(err, spreadsheet) {
            if (err || !spreadsheet) {
              debug(err);
              return;
            }

            // Perform different sheet actions based on the request type.
            if (req.method === 'POST') {
              addRow(spreadsheet);
            }
            else if (req.method === 'PUT') {
              updateRow(spreadsheet);
            }
            else if (req.method === 'DELETE') {
              deleteRow(spreadsheet);
            }
          });
        }
        catch (err) {
          debug(err);
        }
      });
    }
  }

  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
