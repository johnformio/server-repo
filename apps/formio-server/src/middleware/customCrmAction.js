'use strict';

const _ = require('lodash');

module.exports = function(formio) {
  return actionName => function(req, res, next) {
    // move on as we don't need to wait on results.
    /* eslint-disable callback-return */
    next();
    /* eslint-enable callback-return */

    if (process.env.hasOwnProperty('CRM')) {
      formio.resources.project.model.findOne({
        name: 'formio',
        primary: true
      }).exec(function(err, project) {
        if (err) {
          return;
        }

        const modReq = _.cloneDeep(req);
        modReq.projectId = project._id;
        const options = {settings: {}};
        options.settings['url'] = process.env.CRM + actionName;
        const ActionClass = formio.actions.actions['webhook'];
        const action = new ActionClass(options, modReq, res);
        action.resolve('after', 'create', modReq, res, function() {});
      });
    }
  };
};
