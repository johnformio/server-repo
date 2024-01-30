'use strict';

const _ = require('lodash');
const async = require('async');

/**
 *
 * @param formio
 * @returns {{project: deleteProject}}
 */
module.exports = function(formio) {
  /**
   * Flag all the submission of the given forms as deleted.
   *
   * @param {Array|String|ObjectId} forms
   *   A list of form ids to flag all submissions as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteSubmission = function(projectId, forms, next) {
    const util = formio.util;
    if (!forms) {
      return next();
    }
    // Convert the forms to an array if only one was provided.
    if (forms && !(forms instanceof Array)) {
      forms = [forms];
    }

    forms = _(forms)
      .map(util.idToBson)
      .value();

      formio.resources.submission.model.updateMany(
        {
          project: util.idToBson(projectId),
          form: {$in: forms},
          deleted: {$eq: null}
        },
        {
          deleted: Date.now()
        }
      ).then(() => {
        next();
      }).catch(err => {
        next(err);
      });
  };

  /**
   * Flag all Actions in the list of forms as deleted.
   *
   * @param {String|ObjectId|Array} forms
   *   A list of form ids to flag all Actions as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteAction = function(forms, next) {
    const util = formio.util;
    if (!forms) {
      return next();
    }
    // Convert the forms to an array if only one was provided.
    if (forms && !(forms instanceof Array)) {
      forms = [forms];
    }

    forms = _(forms)
      .map(util.idToBson)
      .value();

    const query = {form: {$in: forms}, deleted: {$eq: null}};
    formio.actions.model.updateMany(
      query,
      {
        deleted: Date.now()
      }
    ).then(() => {
      next();
    }).catch(err => {
      next(err);
    });
  };

  /**
   * Flag all forms for the given project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The project id to flag all forms as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteForm = function(projectId, next) {
    const util = formio.util;
    if (!projectId) {
      return next();
    }

    // Find all the forms that are associated with the given projectId and have not been deleted.
    const query = {project: util.idToBson(projectId), deleted: {$eq: null}};
    formio.resources.form.model.find(query).lean().select('_id').exec(function(err, formIds) {
      if (err) {
        return next(err);
      }
      if (!formIds || formIds.length === 0) {
        return next();
      }

      // Force bson ids for searching.
      formIds = _(formIds)
        .map(util.idtoBson)
        .value();

      query._id = {$in: formIds};
      formio.resources.form.model.updateMany(
        query,
        {deleted: Date.now()}
      ).then(()=>{
        deleteAction(formIds, function(err) {
          if (err) {
            return next(err);
          }

          // Update all submissions related to the newly deleted forms, as being deleted.
          deleteSubmission(projectId, formIds, function(err) {
            if (err) {
              return next(err);
            }
            next();
          });
        });
      }).catch(err=>{
        return next(err);
      });
    });
  };

  /**
   * Flag all stages for the given project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The project id to flag all stages as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteStages = function(projectId, next) {
    const util = formio.util;
    if (!projectId) {
      return next();
    }

    // Find all the stages that are associated with the given projectId and have not been deleted.
    const query = {project: util.idToBson(projectId), deleted: {$eq: null}};
    formio.resources.project.model.find(query).lean().select('_id').exec(function(err, stageIds) {
      if (err) {
        return next(err);
      }
      if (!stageIds || stageIds.length === 0) {
        return next();
      }

      Promise.all(
        stageIds.map(stageId => new Promise((res, rej) => {
          deleteProject(stageId, err => err ? rej(err) : res());
        }))
      ).then(() => {
        next();
      }).catch(err => {
        next(err);
      });
    });
  };

  /**
   * Flag all Roles for the given project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The Project id to flag all Roles as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteRole = function(projectId, next) {
    const util = formio.util;
    if (!projectId) {
      return next();
    }

    const query = {project: util.idToBson(projectId), deleted: {$eq: null}};
    formio.resources.role.model.updateMany(query,
      {deleted: Date.now()}
      ).then(() => {
        next();
      }).catch(err => {
        next(err);
      });
  };

  /**
   * Flag a project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The project id to flag as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  function deleteProject(projectId, next) {
    if (!projectId) {
      return next();
    }
    formio.cache.updateProject(projectId, {
      deleted: Date.now()
    }, (err, project) => {
      if (err) {
        return next(err.message || err);
      }
      deleteRole(projectId, function(err) {
        if (err) {
          return next(err.message || err);
        }

        deleteForm(projectId, function(err) {
          if (err) {
            return next(err.message || err);
          }
          else if (project.type !== 'stage') {
            deleteStages(projectId, function(err) {
              if (err) {
                return next(err.message || err);
              }

              next();
            });
          }
          else {
            return next();
          }
        });
      });
    });
  }

  /**
   * Expose the internal functionality for hiding 'deleted' entities.
   */
  return {
    project: deleteProject
  };
};
