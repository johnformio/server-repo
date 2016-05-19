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
          if (field.action !== 'submit') {
            fieldPanel.components.push({
              type: 'textfield',
              input: true,
              label: (field.label || field.key) + ' Column',
              key: 'settings[' + fieldKey + ']',
              placeholder: 'Enter a Column Key. Example: C',
              multiple: false
            });
          }
        });

        next(null, [
          {
            type: 'textfield',
            label: 'Sheet ID',
            key: 'settings[sheetID]',
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
            key: 'settings[worksheetName]',
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
    var requestData = _.get(req, 'body.data');

    // Load the project settings.
    formio.hook.settings(req, function(err, settings) {
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
          async.waterfall([
            function getRowCount(callback) {
              //spreadsheet.metadata(function(err, metadata){
              //  if (err) {
              //    return callback(err);
              //  }
              //
              //  var rows = _.get(metadata, 'rowCount') || 0;
              //  callback(null, rows)
              //});
              spreadsheet.receive({
                getValues: false
              }, function(err, rows, info) {
                if (err) {
                  return callback(err);
                }

                callback(null, (info.nextRow - 1));
              });
            },
            function addColumnLabels(rows, callback) {
              // Build a map of pretty display column labels and the columnId
              var columnLabels = {};
              _.each(columnIds, function(value, key) {
                columnLabels[key] = _.startCase(key);
              });

              // If there are no rows, add the column labels before any data.
              if (rows === 0) {
                // Build row 1 of the spreadsheet, by iterating each column label.
                var data = {};
                var column = 1;

                // Iterate the columns to get the column label and its position.
                _.each(columnIds, function(value, key) {
                  data[value] = {
                    name: [column],
                    val: columnLabels[key]
                  };

                  column += 1;
                });

                // Finally, add all of the row 1 data to the spreadsheet.
                spreadsheet.add({1: data});

                // Iterate the row count, and continue.
                rows += 1;
              }

              callback(null, rows);
            },
            function addNewRow(rows, callback) {
              var row = rows + 1;

              // Build our new row of the spreadsheet, by iterating each column label.
              var data = {};

              // Iterate the columns to get the column label and its position.
              _.each(columnIds, function(value, key) {
                data[value] = {
                  name: key,
                  val: _.get(requestData, key)
                };
              });

              // Finally, add all of the new row data to the spreadsheet.
              var final = {};
              final[row] = data;
              spreadsheet.add(final);

              // Commit all spreadsheet changes, and update the formio submission with an externalId ref to the sheet.
              spreadsheet.send(function(err) {
                if (err) {
                  return callback(err);
                }

                if (!res.resource) {
                  return callback('No resource given in the response.');
                }

                // Store the current resource.
                formio.resources.submission.model.update(
                  {_id: res.resource.item._id},
                  {
                    $push: {
                      externalIds: {
                        type: actionName,
                        id: row
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
        else if (req.method === 'PUT') {
          // Only proceed with deleting a row, if applicable to this request.
        }
        else if (req.method === 'DELETE') {
          // Only proceed with deleting a row, if applicable to this request.
          var deleted = _.get(req, 'formioCache.submissions.' + _.get(req, subId));
        }
      });
    });
  };
  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
