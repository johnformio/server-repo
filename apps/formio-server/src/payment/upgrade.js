var Q = require('q');

module.exports = function(formio) {
  var cache = require('../cache/cache')(formio);
  var emailer = require('formio/src/util/email')(formio);

  return function(req, res, next) {
    if (!req.body) {
      return res.status(400).send('No data received');
    }

    if (!req.body.plan) {
      return res.status(400).send('No project plan received');
    }

    if (formio.plans.getPlans().indexOf(req.body.plan) === -1) {
      return res.status(400).send('Invalid plan');
    }

    if (req.body.plan === 'commercial') {
      return res.status(400).send('Upgrading to commercial is not allowed');
    }

    // Check user has payment info saved
    Q.ninvoke(cache, 'loadProject', req, req.projectId)
    .then(function(project) {
      if (project.owner.toString() !== req.user._id.toString()) {
        res.status(401).send('Only project owners can upgrade a project');
        return Q.reject();
      }
      return formio.payment.userHasPaymentInfo(req)
      .then(function(hasPayment) {
        if (!hasPayment) {
          res.status(400).send('Cannot upgrade project without registered payment info');
          return Q.reject();
        }
      })
      .then(function() {
        return formio.resources.project.model.update({
          _id: req.projectId
        }, {
          plan: req.body.plan
        });
      })
      .then(function(rawResponse) {
        if (rawResponse.ok) {
          return formio.payment.getUpgradeHistoryFormId(req.userProject._id);
        }
        throw 'Error occurred trying to update the project';
      })
      .then(function(formId) {
        return formio.resources.submission.model.create({
          form: formId,
          owner: req.user._id,
          data: {
            projectId: project._id,
            oldPlan: project.plan,
            newPlan: req.body.plan
          }
        });
      })
      .then(function() {
        var emailSettings = {
          transport: 'default',
          from: 'no-reply@form.io',
          emails: ['payment@form.io'],
          subject: 'Project Upgrade Notification',
          message: '<p>A project has been upgraded to <strong>{{newPlan}}</strong>!</p>' +
                    '<p><ul>' +
                      '<li>Username: {{user.data.name}}</li>' +
                      '<li>Name: {{user.data.fullName}}</li>' +
                      '<li>Email: {{user.data.email}}</li>' +
                      '<li>User ID: {{user._id}}</li><br>' +
                      '<li>Project Title: {{project.title}}</li>' +
                      '<li>Old Plan: {{project.plan}}</li>' +
                      '<li>New Plan: {{newPlan}}</li>' +
                      '<li>Project ID: {{project._id}}</li>' +
                    '</ul></p>'
        };
        var params = {project: project, user: req.user, newPlan: req.body.plan};
        return Q.ninvoke(emailer, 'send', req, res, emailSettings, params);
      });


    })
    .then(function() {
      res.sendStatus(200);
    })
    .catch(function(err) {
      if (!res.headersSent) {
        next(err);
      }
    });
  };
};
