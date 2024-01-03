'use strict';
const _ = require('lodash');
const debug = require('debug')('formio:db');
const reportingUITemplate = require('../../../reportingUI.json');

/**
 *
 * Update all Reporting UI forms to the version that works with this server version
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = async function(db, config, tools, done) {
  done();

  debug('Updating Reporting UI configuration forms.');
  const reportingUIForm = _.get(reportingUITemplate, 'resources.reportingui', null);

  if (!reportingUIForm) {
    debug('No Reporting UI configuration form template found.');
    return;
  }

  await db.collection('forms').updateMany({
    deleted: {$eq: null},
    path: {$eq: reportingUIForm.path},
    $or: [
      {'properties.version': {$exists: false}},
      {'properties.version': {$ne: reportingUIForm.properties.version}}
    ]
   }, {
    $set: {
      components: reportingUIForm.components,
      'properties.version': reportingUIForm.properties.version
    }
  });
};
