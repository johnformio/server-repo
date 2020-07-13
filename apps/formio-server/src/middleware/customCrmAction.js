'use strict';

const _ = require('lodash');

module.exports = function(formio) {
  return actionName => function(req, res, next) {
    // move on as we don't need to wait on results.
    /* eslint-disable callback-return */
    next();
    /* eslint-enable callback-return */

    if (process.env.hasOwnProperty('CRM')) {
      const modReq = _.cloneDeep(req);

      if (modReq.body && !modReq.body.name) {
        modReq.body.name = req.currentProject && req.currentProject.name;
      }

      const settings = {
        method: 'POST',
        url: process.env.CRM + actionName
      };

      const options = {settings};
      const ActionClass = formio.actions.actions['webhook'];
      const action = new ActionClass(options, modReq, res);
      action.resolve('after', 'create', modReq, res, () => {}, () => {});
    }
  };
};
