'use strict';

var Q = require('q');
let debug = require('debug')('formio:payment:upgrade');
const _merge = require('lodash/merge');

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
      let billing = project.billing || {};

      return formio.payment.userHasPaymentInfo(req)
      .then(function(hasPayment) {
        // Allow the manual transition from trial to basic.
        if (!hasPayment && ['basic', 'trial'].indexOf(req.body.plan) === -1) {
          res.status(400).send('Cannot upgrade project without registered payment info');
          return Q.reject();
        }

        billing.servers = _merge(billing.servers, req.body.servers);

        return formio.resources.project.model.update({
          _id: formio.util.idToBson(req.projectId)
        }, {
          plan: req.body.plan,
          billing
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
            newPlan: req.body.plan,
            servers: billing.servers
          }
        });
      })
      .then(function() {
        const plans = ['trial', 'basic', 'independent', 'team', 'commercial'];
        const direction = plans.indexOf(project.plan) < plans.indexOf(req.body.plan) ? 'Upgrade' : 'Downgrade';

        /* eslint-disable max-len */
        var emailSettings = {
          transport: 'default',
          from: 'no-reply@form.io',
          emails: ['payment@form.io'],
          subject: 'Project ' + direction + ' Notification',
          message: '<p>A project has been ' + direction.toLowerCase() + 'd from <strong>{{project.plan}}</strong> to <strong>{{newPlan}}</strong>.</p>' +
          '<p><ul>' +
          '<li>Username: {{user.data.name}}</li>' +
          '<li>Name: {{user.data.fullName}}</li>' +
          '<li>Email: {{user.data.email}}</li>' +
          '<li>User ID: {{user._id}}</li><br>' +
          '<li>Project Title: {{project.title}}</li>' +
          '<li>Old Plan: {{project.plan}}</li>' +
          '<li>New Plan: {{newPlan}}</li>' +
          '<li>Project ID: {{project._id}}</li>' +
          '<li>API Servers: {{servers.api}}</li>' +
          '<li>PDF Servers: {{servers.pdf}}</li>' +
          '</ul></p>'
        };
        /* eslint-enable max-len */
        var params = {project: project, user: req.user, newPlan: req.body.plan, servers: billing.servers};
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
