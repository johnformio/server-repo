'use strict';
const debug = require('debug')('formio:middleware:checkRequestAllowed');
const config = require('../../config');
const {ObjectId} = require('formio/src/util/util');
const {isSuperAdmin} = require('../util/util');

const REQUEST_FOR_ARCHIVED_PROJECT_NOT_ALLOWED_ERROR = 'This is not allowed for an Archived project.';

module.exports = (formio) => {
  const projects = formio.db.collection('projects');

  return async (req, res, next) => {
    // Run only on hosted envs, skip for OPTIONS and plan upgrade requests
    if (!config.formio.hosted || req.method === 'OPTIONS' || req.path.endsWith('/upgrade')) {
      return next();
    }

    const primaryProject = await formio.cache.loadPrimaryProject(req);

    // Skip if the request doesn't contain any project information
    if (!primaryProject) {
      return next();
    }

    // Don't allow any POST, PUT, PATCH or DELETE requests for an archived project, except for requests to delete the project
    if (primaryProject.plan === 'archived' && req.method !== 'GET' && !isSuperAdmin(req)
     && !(req.method === 'DELETE' && ( req.originalUrl === '/' || /^\/project\/[a-f0-9]{24}$/.test(req.originalUrl)) && req.currentProject.type !== 'stage')
     ) {
      debug(`Blocking ${req.method} : ${req.originalUrl} for archived project ${primaryProject._id}`);
      return res.status(400).send(REQUEST_FOR_ARCHIVED_PROJECT_NOT_ALLOWED_ERROR);
    }

    // If project plan is either 'trial' or 'basic', check for the trial expiration
    if (['trial', 'basic'].includes(primaryProject.plan)) {
      const currTime = (new Date()).getTime();
      const projTime = (new Date(primaryProject.trial.toString())).getTime();
      const delta = Math.ceil(parseInt((currTime - projTime) / 1000));
      const day = 86400;
      const remaining = 30 - parseInt(delta / day);
      const trialDaysRemaining = remaining > 0 ? remaining : 0;
      // If the project still has trial time remaining, proceed
      if (trialDaysRemaining > 0) {
        return next();
      }
      // If the trial time has ended, archive the project
      debug(`Archiving project ${primaryProject._id}`);
      try {
        await projects.updateOne({
          _id: ObjectId(primaryProject._id)
        }, {
          $set: {'plan': 'archived'}
        });
        return next(REQUEST_FOR_ARCHIVED_PROJECT_NOT_ALLOWED_ERROR);
      }
      catch (err) {
        debug(err);
        return next(err);
      }
    }
    else {
      return next();
    }
  };
};
