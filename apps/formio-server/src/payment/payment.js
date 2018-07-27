'use strict';

const Q = require('q');

module.exports = function(app, formio) {
  // Load custom CRM action.
  formio.middleware.customCrmAction = require('../middleware/customCrmAction')(formio);

  app.post('/payeezy',
    formio.middleware.tokenHandler,
    require('../middleware/userProject')(formio),
    require('./payeezy')(app.formio.config, formio)
  );

  app.post('/project/:projectId/upgrade',
    formio.middleware.tokenHandler,
    require('../middleware/userProject')(formio),
    require('../middleware/restrictOwnerAccess')(formio),
    require('./upgrade')(formio),
    formio.middleware.customCrmAction('upgradeproject')
  );

  let paymentFormId;
  let projectHistoryId;

  const getPaymentFormId = function(projectId) {
    if (paymentFormId) {
      return Q(paymentFormId);
    }

    return Q(formio.resources.form.model.findOne({
      project: projectId,
      name: process.env.PAYEEZY_FORM || 'paymentAuthorization'
    }))
    .then(function(form) {
      if (!form) {
        throw 'Failed to find `paymentAuthorization` form';
      }

      paymentFormId = form._id.toString();
      return paymentFormId;
    });
  };

  const getUpgradeHistoryFormId = function(projectId) {
    if (projectHistoryId) {
      return Q(projectHistoryId);
    }

    return Q(formio.resources.form.model.findOne({
      project: projectId,
      name: process.env.UPGRADE_HISTORY_FORM || 'projectUpgradeHistory'
    }))
    .then(function(form) {
      if (!form) {
        throw 'Failed to find `projectUpgradeHistory` form';
      }

      projectHistoryId = form._id.toString();
      return projectHistoryId;
    });
  };

  const userHasPaymentInfo = function(req) {
    if (!req.user || !req.userProject.primary) {
      return Q.reject('Must be logged in to get payment info');
    }

    return getPaymentFormId(req.userProject._id)
    .then(function(formId) {
      return Q(formio.resources.submission.model.countDocuments({
        form: formId,
        owner: req.user._id
      }));
    })
    .then(function(count) {
      return count > 0;
    });
  };

  return {
    getPaymentFormId: getPaymentFormId,
    getUpgradeHistoryFormId: getUpgradeHistoryFormId,
    userHasPaymentInfo: userHasPaymentInfo
  };
};
