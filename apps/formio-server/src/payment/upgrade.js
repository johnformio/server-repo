var Q = require('q');

module.exports = function(formio) {
  var emailer = require('formio/src/util/email')(formio);

  return function(req, res, next) {
    if (!req.body) {
      return res.status(400).send('No data received');
    }

    if (!req.projectId) {
      return res.status(400).send('No project ID received');
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
    formio.payment.userHasPaymentInfo(req)
    .then(function(hasPayment) {
      if (!hasPayment) return Q.reject('Cannot upgrade project without registered payment info.');
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
        res.sendStatus(200);
        return formio.resources.project.model.findOne({
          _id: req.projectId
        });
      }
      throw 'Error occurred trying to update the project';
    })
    .then(function(project) {
      var emailSettings = {
        transport: 'default',
        from: 'no-reply@form.io',
        emails: ['payment@form.io'],
        subject: 'Project Upgrade Notification',
        message: '<p>A project has been upgraded to <strong>{{project.plan}}</strong>!</p>' +
                  '<p><ul>' +
                    '<li>Username: {{user.data.name}}</li>' +
                    '<li>Name: {{user.data.fullName}}</li>' +
                    '<li>Email: {{user.data.email}}</li>' +
                    '<li>User ID: {{user._id}}</li><br>' +
                    '<li>Project Title: {{project.title}}</li>' +
                    '<li>New Plan: {{project.plan}}</li>' +
                    '<li>Project ID: {{project._id}}</li>' +
                  '</ul></p>'
      };
      emailer.send(req, res, emailSettings, {project: project, user: req.user}, function(err) {
        if (err) {
          next(err);
        }
      });
    })
    .catch(function(err) {
      next(err);
    });
  };
};
