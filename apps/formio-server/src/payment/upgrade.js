'use strict';

var Q = require('q');
let debug = require('debug')('formio:payment:upgrade');

module.exports = function(formio) {
  var cache = require('../cache/cache')(formio);
  var emailer = require('formio/src/util/email')(formio);

  return function(req, res, next) {
    new Promise((resolve, reject) => {
      if (!req.body) {
        return reject('No data received');
      }

      if (!req.body.plan) {
        return reject('No project plan received');
      }

      if (formio.plans.getPlans().indexOf(req.body.plan) === -1) {
        return reject('Invalid plan');
      }

      // Check user has payment info saved
      return resolve(Q.ninvoke(cache, 'loadProject', req, req.projectId));
    })
    .then(function(project) {
      if (project.owner.toString() !== req.user._id.toString()) {
        throw 'Only project owners can upgrade a project';
      }

      return formio.payment.userHasPaymentInfo(req)
      .then(function(hasPayment) {
        // Allow the manual transition from trial to basic.
        if (!hasPayment && ['basic', 'trial'].indexOf(req.body.plan) === -1) {
          res.status(400).send('Cannot upgrade project without registered payment info');
          return Q.reject();
        }

        return formio.resources.project.model.update({
          _id: formio.util.idToBson(req.projectId)
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
    .then(function(response) {
      debug(response);
      return res.sendStatus(200);
    })
    .catch(function(err) {
      try {
        debug(err);
        return res.status(err.status || 400).send(err.message || err);
      }
      catch (e) {
        debug(e);
      }
    });
  };
};
