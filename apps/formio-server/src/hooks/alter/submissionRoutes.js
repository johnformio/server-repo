'use strict';

const _ = require('lodash');
const config = require('../../../config');
const util = require('../../util/util');
const SubmissionRevision = require('../../revisions/SubmissionRevision');
module.exports = app => routes => {
  const submissionRevision = new SubmissionRevision(app);
  const filterExternalTokens = app.formio.formio.middleware.filterResourcejsResponse(['externalTokens']);
  const conditionalFilter = function(req, res, next) {
    if (req.token && res.resource && res.resource.item && res.resource.item._id) {
      // Only allow tokens for the actual user.
      if (req.token.user._id !== res.resource.item._id.toString()) {
        return filterExternalTokens(req, res, next);
      }

      // Whitelist which tokens can be seen on the frontend.
      const allowedTokens = ['dropbox'];
      res.resource.item.externalTokens = _.filter(res.resource.item.externalTokens, function(token) {
        return _.indexOf(allowedTokens, token.type) > -1;
      });

      return next();
    }
    else {
      return filterExternalTokens(req, res, next);
    }
  };

  const addAdminAccess = function(req, res, next) {
    if ((req.url.split('?')[0] === '/current' || req.originalUrl.startsWith('/user/login')) && res.resource && res.resource.item) {
      res.resource.item.isAdmin = req.isAdmin;
      res.resource.item.onlyPrimaryWriteAccess = !!config.onlyPrimaryWriteAccess;
    }

    next();
  };

  const deleteRevisions = function(req, res, next) {
    submissionRevision.delete(req.params.submissionId, next);
  };

  _.each(['afterGet', 'afterIndex', 'afterPost', 'afterPut', 'afterDelete'], function(handler) {
    routes[handler].push(conditionalFilter);
  });

  routes.afterGet.push(addAdminAccess);
  routes.afterDelete.push(deleteRevisions);

  // Add a submission model set before the index.
  routes.beforeIndex.unshift((req, res, next) => app.formio.formio.cache.setSubmissionModel(
    req,
    app.formio.formio.cache.getCurrentFormId(req),
    next
  ));

  // Add the form version id to each submission.
  _.each(['beforePost', 'beforePut'], (handler) => {
    if (handler === 'beforePost') {
      routes[handler].unshift((req, res, next) => app.formio.formio.cache.setSubmissionModel(
        req,
        app.formio.formio.cache.getCurrentFormId(req),
        next
      ));
    }

    routes[handler].push((req, res, next) => {
      if (typeof req.body === 'object') {
        // Always set the project ID to the current project.
        req.body.project = req.projectId || req.params.projectId;

        if (!req.body.hasOwnProperty('_fvid') || isNaN(parseInt(req.body._fvid))) {
          req.body._fvid = req.currentForm._vid || 0;
        }
      }
      next();
    });

    // Skip validation if state is draft.
    // Eventually this will be configurable but hard code to draft == noValidate for now.
    routes[handler].unshift((req, res, next) => {
      if (_.get(req, 'body.state', 'submitted') === 'draft' || req.isAdmin && req.query.noValidate) {
        req.noValidate = true;
      }
      if (req.method.toUpperCase() === 'PATCH') {
        app.formio.formio.mongoose.models.submission.findOne({_id: req.params.submissionId, deleted: null}, (err, submission)=>{
          if (err) {
            return next(err);
          }

          if (submission && submission.state === 'draft' && !req.body.find(update=>update.path.includes('/submit') || update.path === '/state')) {
            req.noValidate = true;
            return next();
          }
          else {
            return next();
          }
        });
      }
      else {
        return next();
      }
    });
});
  _.each(['beforePost', 'beforePut', 'beforeIndex', 'beforeGet'], handler => {
    routes[handler].unshift((req, res, next) => {
      app.formio.formio.cache.loadCurrentForm(req, (err, currentForm) => {
        return util.getSubmissionModel(app.formio.formio, req, currentForm, false, next);
      });
    });
  });

  routes.hooks.post = {
    after(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (err) {
          return next(err);
        }
        if (submissionRevision.shouldCreateNewRevision(req, item, null, form)) {
          return submissionRevision.createVersion(item, req.user, req.body._vnote, (err, revision) => {
            if (err) {
              return next(err);
            }
            return next();
          });
        }
        next();
    });
  }
  };

  routes.hooks.put = {
    before(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (err) {
          return next(err);
        }
        app.formio.formio.cache.loadSubmission(
          req,
          req.body.form,
          req.body._id,
          async (err, loadSubmission) => {
            if (err) {
              return next(err);
            }
            if (loadSubmission && loadSubmission.state === 'draft') {
              const revisions = await app.formio.formio.mongoose.models.submissionrevision.find({
                deleted: {$eq: null},
                _rid: loadSubmission._id
              })
              .sort('-modified')
              .lean();
              loadSubmission = revisions[0] || undefined;
            }
              if (submissionRevision.shouldCreateNewRevision(req, item, loadSubmission, form)) {
                req.shouldCreateSubmissionRevision = true;
              }
            return next();
        });
      });
    },
    after(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (err) {
          return next(err);
        }
        app.formio.formio.cache.loadSubmission(
          req,
          req.body.form,
          req.body._id, async (err, loadSubmission)=>{
            if (err) {
              return next(err);
            }
            if (loadSubmission.state === 'draft') {
              const revisions = await app.formio.formio.mongoose.models.submissionrevision.find({
                deleted: {$eq: null},
                _rid: loadSubmission._id
              })
              .sort('-modified')
              .lean();
              loadSubmission = revisions[0] || undefined;
            }
              if (submissionRevision.shouldCreateNewRevision(req, item, loadSubmission, form) || req.shouldCreateSubmissionRevision) {
                return submissionRevision.createVersion(item, req.user, req.body._vnote, (err, revision) => {
                  if (err) {
                    return next(err);
                  }
                  return next();
                });
              }
              else {
                if (item.containRevisions) {
                  item.containRevisions = false;
                  item.save();
                }
              }
            return next();
        });
    });
    }
  };

  routes.hooks.patch = {
    after(req, res, item, next) {
      app.formio.formio.cache.loadForm(req, null, req.params.formId, (err, form) => {
        if (err) {
          return next(err);
        }
        app.formio.formio.cache.loadSubmission(
          req,
          req.body.form,
          req.body._id, async (err, loadSubmission)=>{
            if (err) {
              return next(err);
            }
            if (loadSubmission.state === 'draft') {
              const revisions = await app.formio.formio.mongoose.models.submissionrevision.find({
                deleted: {$eq: null},
                _rid: loadSubmission._id
              })
              .sort('-modified')
              .lean();
              loadSubmission = revisions[0] || undefined;
            }
            if (submissionRevision.shouldCreateNewRevision(req, item, loadSubmission, form)) {
              return submissionRevision.createVersion(item, null, req.body._vnote, (err, revision) => {
                if (err) {
                  return next(err);
                }
                return next();
              });
            }
            else {
              if (item.containRevisions) {
                item.containRevisions = false;
                item.save();
              }
            }
          return next();
        });
    });
    }
  };

  return routes;
};
