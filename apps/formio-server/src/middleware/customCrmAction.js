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
      if (req.currentProject && (req.currentProject.name || req.currentProject._id)) {
        modReq.body.name = req.currentProject.name;
        modReq.body._id = req.currentProject._id;
      }
      if (actionName === 'upgradeproject' && (!modReq.body._id && modReq.body.project)) {
        modReq.body._id = modReq.body.project;
        delete modReq.body.project;
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
