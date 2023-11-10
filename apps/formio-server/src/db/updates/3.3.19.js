'use strict';
const _ = require('lodash');
const debug = require('debug')('formio:db');
const reportingUITemplate = require('../../../reportingUI.json');

/**
 * Update 3.3.19
 *
 * Update all Reporting UI forms with latest fixes
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = async function(db, config, tools, done) {
  done();

  const reportingUIForm = _.get(reportingUITemplate, 'resources.reportingui', null);

  if (!reportingUIForm) {
    return;
  }

  debug('Updating Reporting UI configuration form.');

  await db.collection('forms').updateMany({ 
    deleted: { $eq: null },
    path: { $eq: reportingUIForm.path }
   }, {$set: { components: reportingUIForm.components }});
};
