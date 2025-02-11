'use strict';

const _ = require('lodash');

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
  const deleteSubmission = async function(projectId, forms) {
    const util = formio.util;
    if (!forms) {
      return;
    }
    // Convert the forms to an array if only one was provided.
    if (forms && !(forms instanceof Array)) {
      forms = [forms];
    }

    forms = _(forms)
      .map(util.idToBson)
      .value();

      await formio.resources.submission.model.updateMany(
        {
          project: util.idToBson(projectId),
          form: {$in: forms},
          deleted: {$eq: null}
        },
        {
          deleted: Date.now()
        }
      );
      return;
  };

  /**
   * Flag all Actions in the list of forms as deleted.
   *
   * @param {String|ObjectId|Array} forms
   *   A list of form ids to flag all Actions as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteAction = async function(forms) {
    const util = formio.util;
    if (!forms) {
      return;
    }
    // Convert the forms to an array if only one was provided.
    if (forms && !(forms instanceof Array)) {
      forms = [forms];
    }

    forms = _(forms)
      .map(util.idToBson)
      .value();

    const query = {form: {$in: forms}, deleted: {$eq: null}};
    await formio.actions.model.updateMany(
      query,
      {
        deleted: Date.now()
      }
    );
  };

  /**
   * Flag all forms for the given project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The project id to flag all forms as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteForm = async function(projectId) {
    const util = formio.util;
    if (!projectId) {
      return;
    }

    // Find all the forms that are associated with the given projectId and have not been deleted.
    const query = {project: util.idToBson(projectId), deleted: {$eq: null}};

    let formIds = await formio.resources.form.model.find(query).lean().select('_id').exec();
    if (!formIds || formIds.length === 0) {
      return;
    }

    // Force bson ids for searching.
    formIds = _(formIds)
      .map(util.idtoBson)
      .value();

    query._id = {$in: formIds};
    await formio.resources.form.model.updateMany(
      query,
      {deleted: Date.now()}
    );
    await deleteAction(formIds);
    // Update all submissions related to the newly deleted forms, as being deleted.
    await deleteSubmission(projectId, formIds);
  };

  /**
   * Flag all stages for the given project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The project id to flag all stages as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteStages = async function(projectId) {
    const util = formio.util;
    if (!projectId) {
      return;
    }

    // Find all the stages that are associated with the given projectId and have not been deleted.
    const query = {project: util.idToBson(projectId), deleted: {$eq: null}};
    const stageIds = await formio.resources.project.model.find(query).lean().select('_id').exec();
     if (!stageIds || stageIds.length === 0) {
      return;
    }

    await Promise.all(stageIds.map(stageId => deleteProject(stageId)));
  };

  /**
   * Flag all Roles for the given project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The Project id to flag all Roles as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  const deleteRole = async function(projectId) {
    const util = formio.util;
    if (!projectId) {
      return;
    }

    const query = {project: util.idToBson(projectId), deleted: {$eq: null}};
    await formio.resources.role.model.updateMany(query,
      {deleted: Date.now()}
      );
    return;
  };

  /**
   * Flag a project as deleted.
   *
   * @param {String|ObjectId} projectId
   *   The project id to flag as deleted.
   * @param {Function} next
   *   The callback function to return the results.
   */
  async function deleteProject(projectId) {
    if (!projectId) {
      return;
    }

    try {
      const project = await formio.cache.updateProject(projectId, {
        deleted: Date.now()
      });

      await deleteRole(projectId);
      await deleteForm(projectId);
      if (project.type !== 'stage') {
        await deleteStages(projectId);
      }
    }
    catch (err) {
      throw (err.message || err);
    }
  }

  /**
   * Expose the internal functionality for hiding 'deleted' entities.
   */
  return {
    project: deleteProject
  };
};
