'use strict';
var _ = require('lodash');
var Q = require('q');
var util = require('./util');
var debug = require('debug')('formio:action:googlesheet');
var Spreadsheet = require('edit-google-spreadsheet');

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
      description: 'Allows you to integrate data into your Google sheets.',
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
          title: 'Google SpreadSheet Fields',
          input: false,
          components: []
        };
        _.each(availableProviders.componentMap, function(field, fieldKey) {
          if (field.action !== 'submit') {
            fieldPanel.components.push({
              type: 'textfield',
              input: true,
              label: 'Column [' + field.label + ']',
              key: 'settings[' + fieldKey + ']',
              placeholder: 'Require SpreadSheet Column Key',
              template: '',
              dataSrc: 'url',
              data: '',
              valueProperty: 'key',
              multiple: false
            });
          }
        });

        next(null, [
          {
            type: 'textfield',
            input: true,
            label: 'SpreadSheet ID',
            key: 'settings[sheetID]',
            placeholder: 'Provide SpreadSheet ID',
            template: '',
            dataSrc: 'url',
            data: '',
            valueProperty: 'key',
            validate: {
              required: true
            },
            multiple: false
          }, {
            label: 'Enter Worksheet Name',
            key: 'settings[worksheetName]',
            inputType: 'text',
            defaultValue: '',
            input: true,
            placeholder: 'Enter Worksheet Name Ex. Sheet1',
            type: 'textfield',
            multiple: false,
            required: true
          },
          fieldPanel
        ]);
      });
    });
  };

  GoogleSheetAction.prototype.resolve = function(handler, method, req, res, next) {

    // Getting Spreadsheet ID and Type from Action.
    var spreadsheetID = this.settings.sheetID;
    var worksheetName = this.settings.worksheetName;
    var appName = this.name;

    // Get the Mapping Settings.
    var mappingSettings = this.settings;

    formio.hook.settings(req, function(err, settings) {
      // Getting OAuth Credentials from Settings.
      var clientId = settings.googlesheet.clientId;
      var clientSecret = settings.googlesheet.cskey;
      var refreshToken = settings.googlesheet.refreshtoken;

      // Get Submission Data
      var submissionData = req.body.data;

      /**
       * Convert action form column alphabetical key to relevant column number.
       * This is being used to identify the column number in spreadsheet to add data in a specific cell.
       * Ex. A=1, B=2,...Z=26
       */
      var spreadSheetCellNo = function toInt(n) {
        var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        var result = 0;
        var len = _.size(n);
        _(n).each(function(character) {
          len = len - 1;
          result += Math.pow(_.size(base), len) * (_.indexOf(base, character) + 1);
        }).value();
        return result;
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
        _.each(mappingSettings, function(val, k) {
          if (k === key) {
            mappedColumnId[key] = spreadSheetCellNo(val, function(err) {
              if (err) {
                return debug(err);
              }
            });
          }
        });
      });

      Spreadsheet.load({
        debug: true,
        oauth2: {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken
        },
        spreadsheetId: spreadsheetID, // fetching data using spreadsheet ID.
        worksheetName: worksheetName
      }, function run(err, spreadsheet, authType) {
        /**
         * Validating and error handling blank formio form submission in
         * case googlesheet action is attached to the form.
         */
        var blankSubmissionStatus = res.resource.status;
        if (blankSubmissionStatus === 400) {
          next();
          debug(err);
          return;
        }
        if (err) {
          next(err);
          debug(err);
          return;
        }
        spreadsheet.receive({
          getValues: false
        }, function(err, rows, info) {
          if (err) {
            next(err);
            debug(err);
            return;
          }

          // Getting Next row value from spreadsheet.
          var nextrow = info.nextRow;
          // Getting External ID
          var currentResource = res.resource;
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
              var headerDataset = {
                [firstRow]: {
                  [value]: {
                    name: [sheetHeader],
                    val: spreadSheetHeaderTitles[key]
                  }
                }
              };
              sheetHeader++;
              spreadsheet.add(headerDataset);
            });
            nextrow = nextrow + 1;
          }

          /**
           * Validating and error handling blank formio form submission in
           * case googlesheet action is attached to the form.
           */
          if (blankSubmissionStatus === 400) {
            next();
            debug(err);
            return;
          }

          // Getting Current resource and its external Id.
          var updatedRownum = res.resource.item.externalIds;
          if (req.method === 'PUT') {
            if (updatedRownum != undefined) {
              var extid = _.pluck(updatedRownum, 'id');
              nextrow = extid[0];
            }
          }

          /**
           *  Deleting Record from spreadsheet.
           *  @getCacheSubmission : Getting form submission data from cache.
           *  @cacheData : Handling single submission from cache data.
           */
          var deleted = res.resource.deleted;
          if (deleted) {
            var getCacheSubmission;
            // Getting submission data
            var cacheData = res.req.formioCache.submissions;
            _.each(cacheData, function(value, key) {
              getCacheSubmission = value;
            });

            // Traversing elements from ExternalIds array.
            var externId = _.pluck([getCacheSubmission], 'externalIds[0].id');
            nextrow = externId[0];

            /**
             *  Adding blank to the spreadsheet row.
             *  @deleteDataset : handling data which is to be deleted from the spreadsheet.
             */
            var deleteval = mappingSettings;
            var columnCount = 1;
            _.each(deleteval, function(value, key) {
              if (key != 'sheetID' && key != 'worksheetName') {
                var col = spreadSheetCellNo(value, function(err) {
                  if (err) {
                    return debug(err);
                  }
                });
                var deleteDataset = {
                  [nextrow]: {
                    [col]: {
                      name: [columnCount],
                      val: ''
                    }
                  }
                };
                columnCount++;
                spreadsheet.add(deleteDataset);
              }
            });
          }

          /**
           *  Adding the nextrow submission to Spreadsheet.
           *  @addDataset : Handling data to be added in the spreadsheet.
           */
          _.each(mappedColumnId, function(value, key) {
            var addDataset = {
              [nextrow]: {
                [value]: {
                  name: key,
                  val: submissionData[key]
                }
              }
            };
            spreadsheet.add(addDataset);
          });

          spreadsheet.send(function(err) {
            if (err) {
              debug(err);
              return;
            }

            // Store the current resource.
            var externalId = '';
            if ((req.method === 'POST') && !externalId) {
              formio.resources.submission.model.update({
                _id: currentResource.item._id
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
                  next(err);
                  debug(err);
                  return;
                }
              });
            }
          });
        });
        // Move onto the next middleware.
        next();
      });
    });
  };
  // Return the GoogleSheetAction.
  return GoogleSheetAction;
};
