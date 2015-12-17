var Q = require('q');

module.exports = function(app) {
  var formio = app.formio.formio;

  app.post('/payeezy', require('./payeezy.js')(app.formio.config, formio));
  app.post('/project/:projectId/upgrade', require('./upgrade.js')(formio));

  var paymentFormId;

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

  var userHasPaymentInfo = function(req) {
    if (!req.user || !req.userProject.primary) {
      return Q.reject('Must be logged in to get payment info');
    }

    return getPaymentFormId(req.userProject._id)
    .then(function(formId) {
      return Q(formio.resources.submission.model.count({
        form: formId,
        owner: req.user._id
      }))
    })
    .then(function(count) {
      return count > 0;
    });
  };

  return {
    getPaymentFormId: getPaymentFormId,
    userHasPaymentInfo: userHasPaymentInfo
  };

};
