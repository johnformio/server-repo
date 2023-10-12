'use strict';

const Q = require('q');
const debug = require('debug')('formio:payment:upgrade');
const _merge = require('lodash/merge');

module.exports = function(formio) {
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
        const billing = project.billing || {};

        return formio.payment.userHasPaymentInfo(req)
          .then(function(hasPayment) {
            // Allow the manual transition from trial to basic.
            if (!hasPayment && ['basic', 'trial', 'archived'].indexOf(req.body.plan) === -1) {
              res.status(400).send('Cannot upgrade project without registered payment info');
              return Q.reject();
            }

            billing.servers = _merge(billing.servers, req.body.servers);

            // update plan for all stages
            return formio.resources.project.model.updateMany({
              project: formio.util.idToBson(req.projectId),
              type: 'stage'
            }, {
              plan: req.body.plan,
            })
              .then(() => {
                // upgrade plan for project itself
                return formio.resources.project.model.updateOne({
                  _id: formio.util.idToBson(req.projectId)
                }, {
                  plan: req.body.plan,
                  billing
                });
              });
          })
          .then(function(rawResponse) {
            if (rawResponse.modifiedCount) {
              // shouldn't we invalidate the cache here? TODO: a better place for this would be in each project create/update
              // middleware pipeline (you could even pass a cache object to ResourceJS!!)
              const cache = formio.cache.cache(req);
              if (cache.projects[project._id]) {
                formio.cache.deleteProjectCache(project);
              }
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
                servers: billing.servers
              }
            });
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
