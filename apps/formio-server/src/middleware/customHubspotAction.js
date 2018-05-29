'use strict';

const _ = require('lodash');

module.exports = function(formio) {
  return function(req, res, next) {
    // move on as we don't need to wait on results.
    /* eslint-disable callback-return */
    next();
    /* eslint-enable callback-return */

    if (process.env.hasOwnProperty('HUBSPOT_PROJECT_FIELD')) {
      formio.resources.project.model.findOne({
        name: 'formio',
        primary: true
      }).exec(function(err, project) {
        if (err) {
          return;
        }

        const modReq = _.cloneDeep(req);
        modReq.projectId = project._id;
        const projectFieldName = process.env.HUBSPOT_PROJECT_FIELD;
        const options = {settings: {}};
        options.settings[`${projectFieldName}_action`] = 'increment';
        options.settings[`${projectFieldName}_value`] = '1';
        options.settings['lifecyclestage_action'] = 'value';
        options.settings['lifecyclestage_value'] = 'opportunity';
        options.settings['customer_status_action'] = 'value';
        options.settings['customer_status_value'] = 'Created Project';
        const ActionClass = formio.actions.actions['hubspotContact'];
        const action = new ActionClass(options, modReq, res);
        action.resolve('after', 'create', modReq, res, function() {});
      });
    }
  };
};
