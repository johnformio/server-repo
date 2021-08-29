'use strict';

const Q = require('q');
const debug = require('debug')('formio:payment:upgrade');
const {getLicenseKey, setLicensePlan} = require('../util/utilization');

module.exports = function(formio) {
  const emailer = require('formio/src/util/email')(formio);

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
      return resolve(Q.ninvoke(formio.cache, 'loadProject', req, req.projectId));
    })
    .then(function(project) {
      if (project.owner.toString() !== req.user._id.toString()) {
        throw 'Only project owners can upgrade a project';
      }
      const billing = {
        pdfs: req.body.pdfs,
        pdfDownloads: req.body.pdfDownloads,
        formManager: !!req.body.formManager,
        accessibility: !!req.body.accessibility,
      };

      return formio.payment.userHasPaymentInfo(req)
      .then(async (hasPayment) => {
        // Allow the manual transition from trial to basic.
        if (!hasPayment && ['basic', 'trial'].indexOf(req.body.plan) === -1) {
          res.status(400).send('Cannot upgrade project without registered payment info');
          return Q.reject();
        }

        const limits = {
          formManagers: req.body.formManager ? 1 : 0,
          accessibilitys: req.body.accessibility ? 1 : 0,
        };

        const addScopes = [];
        if (req.body.formManager) {
          addScopes.push('formManager');
        }
        if (req.body.accessibility) {
          addScopes.push('Accessibility');
        }

        // Ensure pdfs and pdfDownloads are valid.
        if (
          req.body.pdfs &&
          req.body.pdfs > 1 &&
          req.body.pdfs <= 125 &&
          req.body.pdfs % 25 === 0 &&
          req.body.pdfDownloads &&
          req.body.pdfDownloads > 1 &&
          req.body.pdfDownloads <= 5000 &&
          req.body.pdfDownloads % 1000 === 0
        ) {
          limits.pdfs = req.body.pdfs;
          limits.pdfDownloads = req.body.pdfDownloads;
        }

        const licenseKey = getLicenseKey(req);
        await setLicensePlan(formio, licenseKey, req.body.plan, limits, addScopes);

        return await formio.resources.project.model.updateOne({
          _id: formio.util.idToBson(req.projectId)
        }, {
          plan: req.body.plan,
          billing
        });
      })
      .then(function(rawResponse) {
        if (rawResponse.modifiedCount) {
          return formio.payment.getUpgradeHistoryFormId(req.userProject._id);
        }

        throw 'Error occurred trying to update the project';
      })
      .then(function(formId) {
        return formio.resources.submission.model.create({
          project: req.userProject._id,
          form: formId,
          owner: req.user._id,
          data: {
            projectId: project._id,
            oldPlan: project.plan,
            newPlan: req.body.plan,
            billing: JSON.stringify(billing)
          }
        });
      })
      .then(function() {
        const plans = ['trial', 'basic', 'independent', 'team', 'commercial'];
        let direction = plans.indexOf(project.plan) < plans.indexOf(req.body.plan) ? 'Upgrade' : 'Downgrade';
        if (project.plan === req.body.plan) {
          direction = 'Not Change';
        }

        /* eslint-disable max-len */
        const emailSettings = {
          transport: 'default',
          from: formio.config.defaultEmailSource,
          emails: ['payment@form.io'],
          subject: `Project ${direction} Notification`,
          message: `<p>A project has been ${direction.toLowerCase()}d from <strong>{{project.plan}}</strong> to <strong>{{newPlan}}</strong>.</p>` +
          `<p><ul>` +
          `<li>Username: {{user.data.name}}</li>` +
          `<li>Name: {{user.data.fullName}}</li>` +
          `<li>Email: {{user.data.email}}</li>` +
          `<li>User ID: {{user._id}}</li><br>` +
          `<li>Project Title: {{project.title}}</li>` +
          `<li>Old Plan: {{project.plan}}</li>` +
          `<li>New Plan: {{newPlan}}</li>` +
          `<li>Project ID: {{project._id}}</li>` +
          `<li>Pdfs: {{billing.pdfs}}</li>` +
          `<li>Pdf Downloads: {{billing.pdfDownloads}}</li>` +
          `<li>Form Manager: {{billing.formManager}}</li>` +
          `<li>accessibilitys: {{billing.accessibility}}</li>` +
          `</ul></p>`
        };
        /* eslint-enable max-len */
        const params = {
          project: project,
          form: {_id: 'new', project: project._id},
          user: req.user,
          newPlan: req.body.plan,
          servers: billing,
          noUtilization: true,
        };
        return Q.ninvoke(emailer, 'send', req, res, emailSettings, params);
      });
    })
    .then(function(response) {
      res.sendStatus(200);
      return next();
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
