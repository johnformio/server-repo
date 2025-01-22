'use strict';

const _ = require('lodash');
const util = require('../util/util');
const debug = require('debug')('formio:db');
const {LicenseError, ValidationError} = require('../util/errors');

module.exports = function(app) {
  const formio = app.formio.formio;

  const getCurrentForm = async (req) => {
    try {
      const form = await formio.cache.loadCurrentForm(req);
      return {
        ...form,
        settings: req.body.settings ? {
          ...form.settings,
          ...req.body.settings
        } : form.settings,
        components: req.body.components ? req.body.components : form.components,
      };
    }
    catch (err) {
      return req.body;
    }
  };

  const validateFormAgainstSacPackage = (hasSubmissionCollection, hasSacPackage, submissionModel) => {
    if (hasSubmissionCollection && !hasSacPackage) {
      throw new LicenseError('The Security & Compliance package is required to use Submission Collections');
    }

    if (hasSubmissionCollection && !submissionModel) {
      throw new LicenseError('Your project cannot be configured for Submission Collections');
    }
  };

  const validateComponentAgainstSacPackage = (
    component,
    path,
    hasSacPackage,
    hasSubmissionCollection,
    submissionModel
  ) => {
    if (component.encrypted && !hasSacPackage) {
      throw new LicenseError(
        `Cannot set field "${path}" to encrypted, the Security & Compliance package is required to use field-level encryption`
      );
    }
    if (component.dbIndex) {
      if (!hasSacPackage) {
        throw new LicenseError(
          `Cannot create index at path "${path}", the Security & Compliance package is required to create database indexes`
        );
      }

      if (!hasSubmissionCollection) {
        throw new ValidationError(
          `Cannot create index at path "${path}", a Submission Collection is required to create database indexes`
        );
      }

      // the only other way this is falsy is if it is a hosted project
      if (!submissionModel) {
        throw new ValidationError(
          `Cannot create index at path "${path}" because hosted projects cannot be configured for Submission Collections`
        );
      }
    }
  };

  return async function(req, res, next) {
    if ((req.method !== 'POST' && req.method !== 'PUT') || !req.body) {
      return next();
    }
    try {
      const form = await getCurrentForm(req);
      const submissionModel = await util.getSubmissionModel(formio, req, form, false);

      const hasSacPackage = _.get(req, 'licenseTerms.options.sac', false);
      const hasSubmissionCollection = _.get(form, 'settings.collection', false);

      validateFormAgainstSacPackage(hasSubmissionCollection, hasSacPackage, submissionModel);

      const indexesToCreate = [];
      const indexesToPotentiallyDrop = [];
      formio.util.eachComponent(form.components, (component, path) => {
        validateComponentAgainstSacPackage(
          component,
          path,
          hasSacPackage,
          hasSubmissionCollection,
          submissionModel
        );

        if (component.dbIndex) {
          indexesToCreate.push({key: {[`data.${path}`]: 1}});
        }
        else {
          // if form is being created via POST we won't worry about dropping any indexes, otherwise we'll attempt to drop any
          // index associated with this component
          if (
            submissionModel &&
            hasSubmissionCollection &&
            req.method === 'PUT'
          ) {
            indexesToPotentiallyDrop.push(`data.${path}_1`);
          }
        }
      });

      if (!submissionModel) {
        return next();
      }

      // Prior to MongoDB 5.2 you can't drop indexes while an index build is occuring on the same collection; to be safe, we'll wait until
      // we try deletion to make room before attempting to create any indexes; obviously, we pay a performance penalty here, it would be better
      // to perform drop and creation in parallel

      // dropIndexes() will throw an error and roll back if one of the indexes doesn't exist, so we need to check if exists before dropping
      const indexExistsResults = await Promise.all(
        indexesToPotentiallyDrop.map((indexName) => submissionModel.collection.indexExists(indexName))
      );
      const indexesToDrop = indexesToPotentiallyDrop.filter(
        (_, index) => indexExistsResults[index]
      );

      try {
        if (indexesToDrop.length > 0) {
          debug('Attempting to drop some indexes...');
          await Promise.all(
            indexesToDrop.map((indexName) => submissionModel.collection.dropIndex(indexName))
          );
        }
      }
      catch (err) {
        // I don't think we want to fail the op if there's just a drop error
        debug(`Unexpected error while dropping indexes: ${err}, proceeding...`);
      }

      try {
        if (indexesToCreate.length > 0) {
          debug('Creating indexes...');
          await submissionModel.collection.createIndexes(indexesToCreate, {
            background: true,
          });
        }
      }
      catch (err) {
        // something went wrong, so roll back the entire operation (createIndexes should do this for us)
        debug(`Index creation failed: ${err}`);
        return next(err);
      }

      return next();
    }
    catch (err) {
      return res.status(err.status ? err.status : 400).send(err.message || err);
    }
  };
};
