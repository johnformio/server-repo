'use strict';

const Q = require('q');
const gateway = require('./gateway');
const userProject = require('../middleware/userProject');

module.exports = function(app, formio) {
  // Load custom CRM action.
  formio.middleware.customCrmAction = require('../middleware/customCrmAction')(formio);

  const doNotAllowNewAccounts = function(req, res, next) {
    // Skip check for tests.
    if (!process.env.TEST_SUITE) {
      if (!req.user || !req.user.created) {
        return res.status(400).send('Your account cannot perform an upgrade yet. Please try again in one hour.');
      }
      const current = (new Date()).getTime();
      const created = (new Date(req.user.created)).getTime();
      // If less than one hour in milliseconds.
      if ((current - created) < 3600000) {
        return res.status(400).send('Due to security reasons, you must wait 1 hour after creating an account to input credit card information');
      }
    }
    next();
  };

  app.post('/gateway',
  formio.middleware.tokenHandler,
  doNotAllowNewAccounts,
  userProject(formio),
  gateway(app.formio.config, formio)
);

  app.post('/project/:projectId/upgrade',
    formio.middleware.tokenHandler,
    userProject(formio),
    require('../middleware/restrictProjectAccess')(formio)({level: 'owner'}),
    require('./upgrade')(formio),
    formio.middleware.customCrmAction('updateproject')
  );

  let paymentFormId;
  let projectHistoryId;

  const getPaymentFormId = function(projectId) {
    if (paymentFormId) {
      return Q(paymentFormId);
    }

    return Q(formio.resources.form.model.findOne({
      project: projectId,
      name: process.env.PAYMENT_FORM || 'paymentAuthorization'
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
        owner: formio.util.ObjectId(req.user._id),
        'data.transactionStatus': 'approved',
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
