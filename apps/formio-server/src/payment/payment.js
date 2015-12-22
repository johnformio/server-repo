var Q = require('q');
var debug = require('debug')('formio:payment');

module.exports = function(app, formio) {
  var cache = require('../cache/cache')(formio);

  app.post('/payeezy',
    formio.middleware.tokenHandler,
    require('../middleware/userProject')(cache),
    require('./payeezy')(app.formio.config, formio)
  );

  app.post('/project/:projectId/upgrade',
    formio.middleware.tokenHandler,
    require('../middleware/userProject')(cache),
    require('../middleware/restrictOwnerAccess')(formio),
    require('./upgrade')(formio)
  );

  var paymentFormId;
  var projectHistoryId;

  var getPaymentFormId = function(projectId) {
    if (paymentFormId) {
      return Q(paymentFormId);
    }

    return Q(formio.resources.form.model.findOne({
      project: projectId,
      name: process.env.PAYEEZY_FORM || 'paymentAuthorization'
    }))
    .then(function(form) {
      if (!form) throw 'Failed to find `paymentAuthorization` form';

      paymentFormId = form._id.toString();
      return paymentFormId;
    });
  };

  var getUpgradeHistoryFormId = function(projectId) {
    if (projectHistoryId) {
      return Q(projectHistoryId);
    }

    return Q(formio.resources.form.model.findOne({
      project: projectId,
      name: process.env.UPGRADE_HISTORY_FORM || 'projectUpgradeHistory'
    }))
    .then(function(form) {
      if (!form) throw 'Failed to find `projectUpgradeHistory` form';

      projectHistoryId = form._id.toString();
      return projectHistoryId;
    });
  };

  var userHasPaymentInfo = function(req) {
    if (!req.user || !req.userProject.primary) {
      return Q.reject('Must be logged in to get payment info');
    }

    return getPaymentFormId(req.userProject._id)
    .then(function(formId) {
      debug(formId, req.user._id);
      return Q(formio.resources.submission.model.count({
        form: formId,
        owner: req.user._id
      }))
    })
    .then(function(count) {
      debug('Payment info count:', count);
      return count > 0;
    });
  };

  return {
    getPaymentFormId: getPaymentFormId,
    getUpgradeHistoryFormId: getUpgradeHistoryFormId,
    userHasPaymentInfo: userHasPaymentInfo
  };

};
