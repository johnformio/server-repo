'use strict';

var _ = require('lodash');

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

        var modReq = _.cloneDeep(req);
        modReq.projectId = project._id;
        var options = {settings: {}};
        options.settings['url'] = process.env.CRM + actionName;
        var ActionClass = formio.actions.actions['webhook'];
        var action = new ActionClass(options, modReq, res);
        action.resolve('after', 'create', modReq, res, function() {});
      });
    }
  };
};
