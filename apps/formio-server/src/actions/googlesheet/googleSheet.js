'use strict';
var _ = require('lodash');
var nunjucks = require('nunjucks');
var request = require('request');
var Q = require('q');

var qRequest = Q.denodeify(request);
nunjucks.configure([], {
  watch: false
});
var moment = require('moment');
var Excel = require("exceljs");


var debug = require('debug')('formio:action:hubspot');
var Spreadsheet = require('edit-google-spreadsheet');
var SpreadsheetID, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, appName, jsonData, mapping_settings;



module.exports = function (router) {

	/**
	 * googleSheet class.
	 * This class is used to create the Google Sheet action.
	 *
	 * @constructor
	 */

  	var formio = router.formio;
		var googleSheetAction = function (data, req, res) {		

		router.formio.Action.call(this, data, req, res);

		// Getting Spreadsheet ID and Type from Action 
		SpreadsheetID = data.settings["sheetID"];
		appName = data.name;

		// Get the Mapping Settings
		mapping_settings = data.settings;

	};

	// Derive from Action.
	googleSheetAction.prototype = Object.create(router.formio.Action.prototype);
	googleSheetAction.prototype.constructor = googleSheetAction;

	googleSheetAction.info = function (req, res, next) {

		next(null, {
			name: 'googlesheet',
			title: 'Google Sheets',
			description: 'Allows you to integrate Data into your Google sheets.',
			premium: false,
			priority: 0,
			defaults: {
				handler: ['after'],
				method: ['create', 'update', 'delete']
			}
		});
	};

	// Converting numbers into SpreadSheet column keys.
	var spreadSheetColKey = function(n){
		var ordA = 'a'.charCodeAt(0);
		var ordZ = 'z'.charCodeAt(0);
		var len = ordZ - ordA ;
		var s = "";
		while(n > 0) {
			s = String.fromCharCode(n % len + ordA-1) + s;
			n = Math.floor(n / len) - 1;
		}
		return s.toUpperCase();
	}

	// Converting SpreadSheet alphabatical keys to cell numbers;
	var spreadSheetCellNo = function toInt(n)
	{
		var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', i, j, result = 0;
		for (i = 0, j = n.length - 1; i < n.length; i += 1, j -= 1)
			{
				result += Math.pow(base.length, j) * (base.indexOf(n[i]) + 1);
			}
			return result;
	}

	// We need your suggestion on the function below.
	var deleteRecordOnError = function(currentitem){
		// Delete Code using ObjectId
		var MongoClient = require('mongodb').MongoClient;
		var ObjectId = require('mongodb').ObjectID;
		var obid = ObjectId(String(currentitem));
		
		// Connect to the db
		MongoClient.connect("mongodb://localhost:27017/formio", function(err, db) {							
		  db.collection('submissions').remove( { _id: obid }, true );	
	  });		
	};

    // Google spread sheet form setting.
	googleSheetAction.settingsForm = function (req, res, next) {

		// Create the field for Google Sheet Action.
		var fieldSrc = router.formio.hook.alter('url', '/form/' + req.params.formId + '/components', req);
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

			//fieldPanel.components.push();
			_.each(availableProviders.componentMap, function(field, fieldKey) {
				if(field.action != 'submit'){
					fieldPanel.components.push({
						type: 'textfield',
						input: true,
						label: "Column ["+field.label+"]",
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
				},
				{
					label: 'Enter Spread Sheet Name',
					key: 'settings[spreadsheetName]',
					inputType: 'text',
					defaultValue: '',
					input: true,
					placeholder: 'Enter Spread Sheet Name',
					type: 'textfield',
					multiple: false,
					required: true
				},
				fieldPanel
			]);

		}).catch(next);
	};


	googleSheetAction.prototype.resolve = function(handler, method, req, res, next) {		
		
		router.formio.hook.settings(req, function (err, settings) { 
			// Getting OAuth Credentials from Settings
			CLIENT_ID = settings.googlesheet.clientId;
			CLIENT_SECRET = settings.googlesheet.cskey;
			REFRESH_TOKEN = settings.googlesheet.refreshtoken;
			// var ACCESS_TOKEN = settings.googlesheet.accesstoken;

			// Get Submission Data
			jsonData = req.body.data;
			
					
			var  reversejson = {};
			for(var key in jsonData){
				var k1 = key;
				var kd = jsonData[key];
				for(var keymap in mapping_settings){
					var msk = keymap;
					var msv = mapping_settings[keymap];
					if(k1 === keymap )
					{
						reversejson[keymap] = spreadSheetCellNo(mapping_settings[keymap]);
					}
				}
			}			

			Spreadsheet.load({
				debug: true,
				oauth2: {
					client_id: CLIENT_ID,
					client_secret: CLIENT_SECRET,
					refresh_token: REFRESH_TOKEN
				},
				spreadsheetId: SpreadsheetID, // fetching data using spreadsheet ID
				worksheetName: 'Sheet1',
			}, function run(err, spreadsheet, authType) {					
			
			// Verifying blank form entry 
			var blanksubmissionstatus = res.resource.status;
			if (blanksubmissionstatus == 400) {						
				next("Please make sure to enter value for atleast one form field.");
        debug(err);		
        return;
      }

			var currentitem = res.resource.item._id;
			if (err) {						
				deleteRecordOnError(currentitem);							
				next(err);
        debug(err);		
        return;
      }

			spreadsheet.receive({getValues:false},function(err, rows, info) {
				//if(err) throw err;
				if (err) {											
					deleteRecordOnError(currentitem);
					next(err);
						debug(err);					         				            
						return;
				}

				var i = 1;

				// Getting Next row value from spreadsheet
				var nextrow =  info["nextRow"];

				// Getting External ID
				var currentResource = res.resource;

				// Creating Header for Spreadsheet
				var spreadSheetHeaderTitles = {};
				for(var temp in reversejson){
					var headKey = temp.replace(/([A-Z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); });
					spreadSheetHeaderTitles[temp] = headKey;
				}

				// Setting Header for Spreadsheet
				if (nextrow == 1)
				{
					var count = 1;
					for(var key in reversejson) {
						var dataset1 = { 1: {[reversejson[key]]: { name: [count], val: spreadSheetHeaderTitles[key] } }};
						count++;
						spreadsheet.add(dataset1);
					}
					nextrow = nextrow +1;
				}				

				if (blanksubmissionstatus == 400) {						
				next("Please make sure to enter value for atleast one form field.");
        debug(err);		
        return;
      	}

      	

      	if(req.method === 'PUT'){
      		// Getting Current resource and its external Id	          		
					var updatedRownum = res.resource.item.externalIds;					
					if (updatedRownum != [])
					{
						var newRecord;
						for(var i in updatedRownum){
							newRecord = updatedRownum[i];
						}

						var newrownum;
						for(var ip in newRecord){
							var val = ip;
							if (val == 'id')
							{
								newrownum = newRecord[val];
							}
						}
						if (newrownum != undefined) {
							nextrow = newrownum;		              
						}
					}
      	}
						         

      	if(req.method === 'DELETE'){
      		// Deleting Record from spreadsheet 
					var deleted = res.resource.deleted;

					if(deleted == true){           		          	

						var externdata;
						var subdata;
						var externid;

						// Getting submission data
						for(var key in res.req.formioCache.submissions){	               		
								 subdata = res.req.formioCache.submissions[key];	
						}      

									// Traversing elements from ExternalIds array
						for(var k in subdata)    
						{ 
							if(k == 'externalIds'){
								externdata = subdata[k];      
							}
						}

						// Getting row number from externalIds array
						_.findIndex(externdata, function(chr) {
						externid = chr.id;
						});

						nextrow = externid;

						// Adding Blank to the spreadsheet Row
						var deleteval = mapping_settings;						

						var count = 1;								
						for(var key in deleteval) 
						{
							var value = deleteval[key];
							if(key != 'sheetID' && key != 'spreadsheetName')
							{
								var col = spreadSheetCellNo(deleteval[key]);							
								var dataset1 = { [nextrow]: {[col]: { name: [count], val: '' } }};
								count++;						
								spreadsheet.add(dataset1);
							}	
						}				
					}
      	}
				

						// Adding the nextrow submission to Spreadsheet
				for(var key in reversejson) {
					var dataset = { [nextrow]: {[reversejson[key]]: { name: key, val: jsonData[key] } }};
					spreadsheet.add(dataset);
				}

				spreadsheet.send(function(err) {
					if (err) {							
						deleteRecordOnError(currentitem);
						next(err);
						debug(err);					         				            
						return;
					}

					// Store the current resource.
					var externalId = '';
					if ((req.method === 'POST') && !externalId) {
						router.formio.resources.submission.model.update({
							_id: currentResource.item._id
						}, {
							$push: {
								// Add the external ids
								externalIds: {
									type: appName,
									id: nextrow
								}
							}
						}, function (err, result) {

							if (err) {									
								deleteRecordOnError(currentitem);
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

	// Return the googleSheetAction.
	return googleSheetAction;

};
