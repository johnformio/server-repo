'use strict';
const _ = require('lodash');
const config = require('../../config');
const debug = require('debug')('formio:error');
module.exports = class Revision {
  constructor(app, type, trackedProperties, revisionPlans) {
    this.revisionPlans = revisionPlans || ['trial', 'commercial'];
    this.type = type;
    this.trackedProperties = trackedProperties || [];
    this.revisionModel = app.formio.formio.mongoose.models[`${type}revision`];
    this.app = app;
    this.idToBson = app.formio.formio.util.idToBson;
    this.itemModel = app.formio.formio.mongoose.models[type];
  }

  checkRevisionPlan(plan) {
    return this.revisionPlans.includes(plan);
  }

  async revisionsAllowed(req) {
    const validatePlan = (project) => {
      return this.checkRevisionPlan(project.plan)
            && !config.formio.hosted
            && (this.app.license
              && !this.app.license.licenseServerError
              && _.get(req, 'licenseTerms.options.sac', false));
    };
    if (req.primaryProject) {
      return validatePlan(req.primaryProject);
    }
    const project = await this.app.formio.formio.cache.loadPrimaryProject(req);
    if (!project) {
      debug(`Unable to load primary project`);
      return false;
    }
    req.primaryProject = project;
    return validatePlan(project);
  }

  async shouldCreateNewRevision(req, item, loadItem, form) {
    const configurationAllowsRevisions = await this.revisionsAllowed(req);
    if (!configurationAllowsRevisions) {
      return false;
    }

    const currentFormTrackedProperties = _.pick(loadItem, this.trackedProperties);
    const updatedFormTrackedProperties = _.pick(req.body, this.trackedProperties);
    const isChanged = !_.isEqual(currentFormTrackedProperties, updatedFormTrackedProperties);
    const areRevisionsAllowed = (item.revisions || form && form[`${this.type}Revisions`]);
    return (
      req.isDraft ||
      item.revisions && !form.revisions ||
      (areRevisionsAllowed && isChanged)
    );
  }

  async delete(rid, next) {
    try {
      await this.revisionModel.updateMany(
        {
          _rid: this.idToBson(rid),
          deleted: {$eq: null}
        },
        {
          deleted: Date.now(),
          markModified: 'deleted'
        });
        return next();
    }
    catch (err) {
      return next(err);
    }
  }
};
