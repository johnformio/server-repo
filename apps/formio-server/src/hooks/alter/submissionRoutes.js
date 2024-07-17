'use strict';

const _ = require('lodash');
const config = require('../../../config');
const util = require('../../util/util');
const SubmissionRevision = require('../../revisions/SubmissionRevision');
const ESignature = require('../../esignature/ESignature');
const debug = require('debug')('formio:error');

module.exports = app => routes => {
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

  const attachSignatures = function(req, res, next) {
    const esignature = new ESignature(app, req);

    if (esignature.allowESign()) {
      app.formio.formio.cache.loadSubmission(
        req,
        req.params.formId,
        req.params.submissionId,
        async (err, loadSubmission) => {
          if (err) {
            return next(err);
          }
          return esignature.validateAndAttachESignatures(res.resource.item, loadSubmission, req.currentForm,  (err) => {
            if (err) {
              return next(err);
            }
            return next();
          });
        });
    }
    else {
      return next();
    }
  };

  _.each(['afterGet', 'afterIndex', 'afterPost', 'afterPut', 'afterDelete'], function(handler) {
    routes[handler].push(conditionalFilter);
  });

  routes.beforeDelete.unshift((req, res, next) => {
    app.formio.formio.cache.loadCurrentForm(req, (err, currentForm) => {
      if (err || !currentForm) {
        debug(`Unable to load current form. ${err}`);
        return next();
      }

      const submissionRevision = new SubmissionRevision(app, req.submissionModel || null);
      if (submissionRevision.revisionsAllowed(req) && currentForm.submissionRevisions) {
        debug(`Unable to delete submission ${req.params?.submissionId} with enabled submission revisions.`);
        return res.status(403).send('Deletion is not allowed when submission revisions are enabled.');
      }
      return next();
    });
  });

  routes.afterGet.push(attachSignatures);
  routes.afterGet.push(addAdminAccess);
  routes.afterDelete.push((req, res, next)=> {
    const submissionRevision = new SubmissionRevision(app, req.submissionModel || null);
    submissionRevision.delete(req.params.submissionId, next);
  });

  routes.afterDelete.push((req, res, next)=> {
    const esignature = new ESignature(app, req);
    esignature.delete(req.params.submissionId, next);
  });

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
        const submissionRevision = new SubmissionRevision(app, req.submissionModel || null);
        if (submissionRevision.shouldCreateNewRevision(req, item, null, form)) {
          return submissionRevision.createVersion(item, req.user, req.body._vnote, (err, revision) => {
            if (err) {
              return next(err);
            }
            const esignature = new ESignature(app, req);
            if (esignature.allowESign()) {
              return esignature.checkSignatures(item, revision, form, (err) => {
                if (err) {
                  return next(err);
                }
                return next();
              });
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
        const submissionRevision = new SubmissionRevision(app, req.submissionModel || null);
        app.formio.formio.cache.loadSubmission(
          req,
          req.body.form,
          req.body._id,
          async (err, loadSubmission) => {
            if (err) {
              return next(err);
            }
            loadSubmission = await submissionRevision.checkDraft(loadSubmission);
            if (submissionRevision.shouldCreateNewRevision(req, item, loadSubmission, form)) {
              req.shouldCreateSubmissionRevision = true;
              const esignature = new ESignature(app, req);
              if (esignature.allowESign()) {
                req.prevESignatures = loadSubmission.eSignatures;
              }
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
        const submissionRevision = new SubmissionRevision(app, req.submissionModel || null);
        app.formio.formio.cache.loadSubmission(
          req,
          req.body.form,
          req.body._id, async (err, loadSubmission)=>{
            if (err) {
              return next(err);
            }
            loadSubmission = await submissionRevision.checkDraft(loadSubmission);
              if (submissionRevision.shouldCreateNewRevision(req, item, loadSubmission, form) || req.shouldCreateSubmissionRevision) {
                return submissionRevision.createVersion(item, req.user, req.body._vnote, (err, revision) => {
                  if (err) {
                    return next(err);
                  }
                  const esignature = new ESignature(app, req);
                  if (esignature.allowESign()) {
                    return esignature.checkSignatures(item, revision, form,  (err) => {
                      if (err) {
                        return next(err);
                      }
                      return next();
                    });
                  }
                  return next();
                });
              }
              else {
                if (item.containRevisions) {
                  app.formio.formio.mongoose.models.submission.updateOne({
                    _id: item._id
                  },
                  {$set: {
                    containRevisions: false,
                  }},
                  (err)=>{
                    if (err) {
                      return next(err);
                    }
                    return next();
                  });
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
        const submissionRevision = new SubmissionRevision(app, req.submissionModel || null);
        app.formio.formio.cache.loadSubmission(
          req,
          req.body.form,
          req.body._id, async (err, loadSubmission)=>{
            if (err) {
              return next(err);
            }
            loadSubmission = await submissionRevision.checkDraft(loadSubmission);
            if (submissionRevision.shouldCreateNewRevision(req, item, loadSubmission, form)) {
              return submissionRevision.createVersion(item, null, req.body._vnote, (err, revision) => {
                if (err) {
                  return next(err);
                }
                const esignature = new ESignature(app, req);
                if (esignature.allowESign()) {
                  req.prevESignatures = loadSubmission?.eSignatures || [];
                  return esignature.checkSignatures(item, revision, form,  (err) => {
                    if (err) {
                      return next(err);
                    }
                    return next();
                  });
                }
                return next();
              });
            }
            else {
              if (item.containRevisions) {
                app.formio.formio.mongoose.models.submission.updateOne({
                  _id: item._id
                },
                {$set: {
                  containRevisions: false,
                }},
                // {
                //   containRevisions: false
                // },
                (err)=>{
                  if (err) {
                    return next(err);
                  }
                  return next();
                });
              }
            }
          return next();
        });
    });
    }
  };

  return routes;
};
