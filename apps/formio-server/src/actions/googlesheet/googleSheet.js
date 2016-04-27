'use strict';
var _ = require('lodash');
var Q = require('q');
var util = require('./util');
var debug = require('debug')('formio:action:googlesheet');
var Spreadsheet = require('edit-google-spreadsheet');
var SpreadsheetColumn = require('spreadsheet-column');

module.exports = function(router) {
  /**
   * googleSheet class.
   * This class is used to create the Google Sheet action.
   *
   * @constructor
   */
  var formio = router.formio;
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

  // Google spreadsheet form settings.
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
      ]).spread(function(availableProviders, form) {
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

  GoogleSheetAction.prototype.resolve = function(handler, method, req, res, next) {
    // No feedback needed directly. Call next immediately.
    /* eslint-disable */
    next();
    /* eslint-enable */

    // Getting Spreadsheet ID and Type from Action.
    var spreadsheetID = this.settings.sheetID;
    var worksheetName = this.settings.worksheetName;
    var appName = this.name;

    // Get the Mapping Settings.
    var mappingSettings = this.settings;

    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug(err);
      }
      // Getting OAuth Credentials from Settings.
      var clientId = settings.google.clientId;
      var clientSecret = settings.google.cskey;
      var refreshToken = settings.google.refreshtoken;

      // Get Submission Data
      var submissionData = req.body.data;
      // @param sc = Spreadsheet Column.
      var sc = new SpreadsheetColumn();

      /*
       * Delete row function
       * @param nextrow
       * @param getCacheSubmission
       */
      var deleteSpreadSheetRow = function(spreadsheet, cacheData) {
        var nextrow;
        var getCacheSubmission;
        // Getting submission data
        _.each(cacheData, function(value, key) {
          getCacheSubmission = value;
        });

        // Traversing elements from ExternalIds array.
        var externId = getCacheSubmission.externalIds;
        var getIdObject = _.find(externId, 'id');
        var getId = getIdObject.id;
        /*
         * exception handline while on delete data action from submissions and the relative data is not available in
         * spreadsheet.
         */
        if (!getId) {
          debug(err);
        }
        nextrow = getId;

        /**
         *  Adding blank to the spreadsheet row.
         *  @deleteDataset : handling data which is to be deleted from the spreadsheet.
         */
        var deleteval = mappingSettings;
        var columnCount = 1;
        _.each(deleteval, function(value, key) {
          if (String(key) !== 'sheetID' && String(key) !== 'worksheetName') {
            var col = sc.fromStr(value);
            var deleteDataset = {};
            deleteDataset[nextrow] = {};
            deleteDataset[nextrow][col] = {
              name: [columnCount],
              val: ''
            };
            columnCount++;
            spreadsheet.add(deleteDataset);
          }
        });
      };

      /**
       * Since, Googlesheet columns can be identified by column numbers but,
       * based on our requirement we need to map fields by alphabets.
       * We are re-arranging the existing key values for spreadsheet,
       * Because by default the key values are in alphabetical order in our database,
       * and we need to rearrange them as per our requirements.
       */
      var mappedColumnId = {};
      _.each(submissionData, function(value, key) {
        _.each(mappingSettings, function(mapval, k) {
          if (k === key) {
            mappedColumnId[key] = sc.fromStr(mapval);
          }
        });
      });

      /* eslint-disable camelcase */
      Spreadsheet.load({
        debug: true,
        oauth2: {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken
        },
        /* eslint-disable camelcase */
        spreadsheetId: spreadsheetID, // fetching data using spreadsheet ID.
        worksheetName: worksheetName
      }, function run(err, spreadsheet, authType) {
        /**
         * Validating and error handling blank formio form submission in
         * case googlesheet action is attached to the form.
         */
        if (res.resource) {
          var blankSubmissionStatus = res.resource.status;
          if (blankSubmissionStatus === 400) {
            debug(err);
          }
          if (err) {
            return debug(err);
          }
        }
        spreadsheet.receive({
          getValues: false
        }, function(err, rows, info) {
          if (err) {
            return debug(err);
          }

          // Getting Next row value from spreadsheet.
          var nextrow = info.nextRow;

          /**
           * Creating spreadsheet headers if data coming to it first time.
           * Formatting headers to display it in Title Case.
           */
          var spreadSheetHeaderTitles = {};
          _.each(mappedColumnId, function(value, key) {
            // Converting raw data into title case.
            spreadSheetHeaderTitles[key] = _.startCase(key);
          });

          /**
           *  Setting up the first row of the spreadsheet as header.
           *  @sheetHeader - is a spreadsheet header column number.
           */
          if (nextrow === 1) {
            var sheetHeader = 1;
            var firstRow = 1;
            _.each(mappedColumnId, function(value, key) {
              var headerDataset = {};
              headerDataset[firstRow] = {};
              headerDataset[firstRow][value] = {
                name: [sheetHeader],
                val: spreadSheetHeaderTitles[key]
              };
              sheetHeader++;
              spreadsheet.add(headerDataset);
            });
            nextrow = nextrow + 1;
          }

          // Getting Current resource and its external Id.
          if (res.resource) {
            var updatedRownum = res.resource.item.externalIds;
            if (req.method === 'PUT') {
              if (updatedRownum !== undefined) {
                var getIdObject = _.find(updatedRownum, 'id');
                var getId = getIdObject.id;
                nextrow = getId;
              }
            }
          }

          /**
           *  Deleting Record from spreadsheet.
           *  @getCacheSubmission : Getting form submission data from cache.
           *  @cacheData : Handling single submission from cache data.
           */
          if (res.resource) {
            var deleted = res.resource.deleted;
            if (deleted) {
              var cacheData = res.req.formioCache.submissions;
              deleteSpreadSheetRow(spreadsheet, cacheData);
            }
          }

          /**
           *  Adding the nextrow submission to Spreadsheet.
           *  @addDataset : Handling data to be added in the spreadsheet.
           */
          _.each(mappedColumnId, function(value, key) {
            var addDataset = {};
            addDataset[nextrow] = {};
            addDataset[nextrow][value] = {
              name: key,
              val: submissionData[key]
            };
            spreadsheet.add(addDataset);
          });

          spreadsheet.send(function(err) {
            if (err) {
              debug(err);
              return;
            }

            // Store the current resource.
            if (req.method === 'POST' && res.resource) {
              formio.resources.submission.model.update({
                _id: res.resource.item._id
              }, {
                $push: {
                  // Add the external ids.
                  externalIds: {
                    type: appName,
                    id: nextrow
                  }
                }
              }, function(err, result) {
                if (err) {
                  debug(err);
                }
              });
            }
          });
        });
      });
    });
  };
  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
