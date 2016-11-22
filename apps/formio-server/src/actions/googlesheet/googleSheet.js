'use strict';

var _ = require('lodash');
var Q = require('q');
var util = require('./util');
var debug = require('debug')('formio:action:googlesheet');
var Spreadsheet = require('edit-google-spreadsheet');
var SpreadsheetColumn = (new (require('spreadsheet-column'))());
var async = require('async');

module.exports = function(router) {
  var formio = router.formio;

  /**
   * GoogleSheetAction class.
   *  This class is used to create the Google Sheet action.
   *
   * @constructor
   */
  var GoogleSheetAction = function(data, req, res) {
    formio.Action.call(this, data, req, res);
  };

  // Derive from Action.
  GoogleSheetAction.prototype = Object.create(formio.Action.prototype);
  GoogleSheetAction.prototype.constructor = GoogleSheetAction;
  GoogleSheetAction.info = function(req, res, next) {
    next(null, {
      name: 'googlesheet',
      title: 'Google Sheets',
      description: 'Allows you to integrate data into Google sheets.',
      premium: false,
      priority: 0,
      defaults: {
        handler: ['after'],
        method: ['create', 'update', 'delete']
      }
    });
  };

  // The actions settings form.
  GoogleSheetAction.settingsForm = function(req, res, next) {
    /**
     * Verifying settings form data and restricting action form loading if any of the settings field data is missing.
     */
    util.checkOauthParameters(router, req, function(err, settings) {
      if (err) {
        return next(null, {});
      }

      // Creating the field for Google Sheet Action.
      Q.all([
        Q.ninvoke(formio.cache, 'loadCurrentForm', req)
      ]).spread(function(availableProviders) {
        // Create the panel for all the fields.
        var fieldPanel = {
          type: 'panel',
          theme: 'info',
          title: 'Google Sheet Fields',
          input: false,
          components: []
        };
        _.each(availableProviders.componentMap, function(field, fieldKey) {
          if (field.action !== 'submit' && field.input) {
            fieldPanel.components.push({
              type: 'textfield',
              input: true,
              label: (field.label || field.key) + ' Column',
              key: fieldKey,
              placeholder: 'Enter a Column Key. Example: C',
              multiple: false
            });
          }
        });

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
  };

  // The actions core execution logic.
  GoogleSheetAction.prototype.resolve = function(handler, method, req, res, next) {
    // No feedback needed directly. Call next immediately.
    next(); // eslint-disable-line callback-return

    var actionName = _.get(this, 'name');
    var actionSettings = _.get(this, 'settings');
    var sheetId = _.get(this, 'settings.sheetID');
    var sheetName = _.get(this, 'settings.worksheetName');

    // Load the project settings.
    formio.hook.settings(req, function(err, settings) {
      var requestData = _.get(req, 'body.data');
      if (err) {
        debug(err);
        return;
      }

      // Map each piece of submission data to a column using the custom mapping in the action settings.
      var columnIds = {};
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
      var addRow = function(spreadsheet) {
        async.waterfall([
          function getAvailableRows(callback) {
            spreadsheet.metadata(function(err, metadata) {
              if (err) {
                return callback(err);
              }

              var rows = parseInt(_.get(metadata, 'rowCount') || 0);
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
              var currentRows = (info.nextRow - 1);
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
            var columnLabels = {};
            _.each(columnIds, function(value, key) {
              columnLabels[key] = _.startCase(key);
            });

            // If there are no rows, add the column labels before adding row 1.
            if (rows === 0) {
              var rowData = {};
              var column = 1;

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
            var rowId = rows + 1;

            // Build our new row of the spreadsheet, by iterating each column label.
            var rowData = {};
            _.each(columnIds, function(value, key) {
              rowData[value] = {
                name: key,
                val: _.get(requestData, key)
              };
            });

            // Finally, add all of the new row data to the spreadsheet.
            var update = {};
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
      };

      /**
       * Util function to update a row in the given spreadsheet.
       *
       * @param {Object} spreadsheet
       *   A loaded Google Spreadsheet.
       */
      var updateRow = function(spreadsheet) {
        // Only proceed with updating a row, if applicable to this request.
        if (!_.has(res, 'resource.item') || !_.has(res, 'resource.item.externalIds')) {
          return;
        }

        // The row number to update.
        var rowId = _.find(res.resource.item.externalIds, function(item) {
          return item.type === actionName;
        });
        rowId = _.get(rowId, 'id');
        if (!rowId) {
          return;
        }

        // Build our new row of the spreadsheet, by iterating each column label.
        var rowData = {};
        var submission = _.get(res, 'resource.item.data');

        // Iterate the columns to get the column label and its position.
        _.each(columnIds, function(value, key) {
          rowData[value] = {
            name: key,
            val: _.get(submission, key)
          };
        });

        // Finally, add all of the data to the row and commit the changes.
        var update = {};
        update[rowId] = rowData;
        spreadsheet.add(update);
        spreadsheet.send(function(err) {
          if (err) {
            debug(err);
          }

          return;
        });
      };

      /**
       * Util function to delete a row from the given spreadsheet.
       *
       * @param {Object} spreadsheet
       *   A loaded Google Spreadsheet.
       */
      var deleteRow = function(spreadsheet) {
        // Only proceed with deleting a row, if applicable to this request.
        var deleted = _.get(req, 'formioCache.submissions.' + _.get(req, 'subId'));
        if (!deleted) {
          return;
        }

        // The row number to delete.
        var rowId = _.find(deleted.externalIds, function(item) {
          return item.type === actionName;
        });
        rowId = _.get(rowId, 'id');
        if (!rowId) {
          return;
        }

        // Build our blank row of data, by iterating each column label.
        var rowData = [];

        // Get the number of fields from the action settings; subtract 2 for the sheetId and worksheet name.
        var fields = ((Object.keys(actionSettings)).length - 2) || 0;
        for (var a = 0; a < fields; a++) {
          rowData.push('');
        }

        // Finally, update our determined row with empty data.
        var update = {};
        update[rowId] = rowData;
        spreadsheet.add(update);
        spreadsheet.send(function(err) {
          if (err) {
            debug(err);
          }

          return;
        });
      };

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
        if (err) {
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
    });
  };
  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
