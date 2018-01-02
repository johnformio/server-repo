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
  const deleteSubmission = function(forms, next) {
    const debug = require('debug')('formio:delete:project_submission');
    const util = formio.util;
    if (!forms) {
      debug('Skipping');
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
    debug(query);
    formio.resources.submission.model.find(query, function(err, submissions) {
      if (err) {
        debug(err);
        return next(err);
      }
      if (!submissions || submissions.length === 0) {
        return next();
      }

      async.eachSeries(submissions, function(submission, cb) {
        submission.deleted = Date.now();
        submission.markModified('deleted');
        submission.save(function(err) {
          if (err) {
            debug(err);
            return cb(err);
          }

          cb();
        });
      }, function(err) {
        if (err) {
          return next(err);
        }

        next();
      });
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
    const debug = require('debug')('formio:delete:project_action');
    const util = formio.util;
    if (!forms) {
      debug('Skipping');
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
    debug(query);
    formio.actions.model.find(query, function(err, actions) {
      if (err) {
        debug(err);
        return next(err);
      }
      if (!actions || actions.length === 0) {
        return next();
      }

      async.eachSeries(actions, function(action, cb) {
        action.deleted = Date.now();
        action.markModified('deleted');
        action.save(function(err) {
          if (err) {
            debug(err);
            return cb(err);
          }

          cb();
        });
      }, function(err) {
        if (err) {
          return next(err);
        }

        next();
      });
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
    const debug = require('debug')('formio:delete:project_form');
    const util = formio.util;
    if (!projectId) {
      debug('Skipping');
      return next();
    }

    // Find all the forms that are associated with the given projectId and have not been deleted.
    let query = {project: util.idToBson(projectId), deleted: {$eq: null}};
    debug(query);
    formio.resources.form.model.find(query).select('_id').exec(function(err, formIds) {
      if (err) {
        debug(err);
        return next(err);
      }
      if (!formIds || formIds.length === 0) {
        debug(`No forms found with the project: ${projectId}`);
        return next();
      }

      // Force bson ids for searching.
      formIds = _(formIds)
        .map(util.idtoBson)
        .value();

      query = {_id: {$in: formIds}, deleted: {$eq: null}};
      debug(query);
      formio.resources.form.model.find(query).snapshot().exec(function(err, forms) {
        if (err) {
          debug(err);
          return next(err);
        }
        if (!forms || forms.length === 0) {
          return next();
        }

        // Mark all un-deleted forms as deleted.
        async.eachSeries(forms, function(form, cb) {
          form.deleted = Date.now();
          form.markModified('deleted');
          form.save(function(err) {
            if (err) {
              return cb(err);
            }

            cb();
          });
        }, function(err) {
          if (err) {
            debug(err);
            return next(err);
          }

          // Delete all the actions for the given list of forms.
          deleteAction(formIds, function(err) {
            if (err) {
              debug(err);
              return next(err);
            }

            // Update all submissions related to the newly deleted forms, as being deleted.
            deleteSubmission(formIds, function(err) {
              if (err) {
                debug(err);
                return next(err);
              }

              next();
            });
          });
        });
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
    const debug = require('debug')('formio:delete:project_role');
    const util = formio.util;
    if (!projectId) {
      debug('Skipping');
      return next();
    }

    const query = {project: util.idToBson(projectId), deleted: {$eq: null}};
    debug(query);
    formio.resources.role.model.find(query, function(err, roles) {
      if (err) {
        debug(err);
        return next(err);
      }
      if (!roles || roles.length === 0) {
        debug(`No roles found with the project: ${projectId}`);
        return next();
      }

      async.eachSeries(roles, function(role, cb) {
        role.deleted = Date.now();
        role.markModified('deleted');
        role.save(function(err) {
          if (err) {
            return cb(err);
          }

          cb();
        });
      }, function(err) {
        if (err) {
          debug(err);
          return next(err);
        }

        next();
      });
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
  const deleteProject = function(projectId, next) {
    const debug = require('debug')('formio:delete:project');
    const util = formio.util;
    if (!projectId) {
      debug('Skipping');
      return next();
    }

    const query = {_id: util.idToBson(projectId), deleted: {$eq: null}};
    debug(query);
    formio.resources.project.model.findOne(query, function(err, project) {
      if (err) {
        debug(err);
        return next(err.message || err);
      }
      if (!project) {
        debug(`No project found with _id: ${projectId}`);
        return next();
      }

      project.deleted = Date.now();
      project.markModified('deleted');
      project.save(function(err) {
        if (err) {
          debug(err);
          return next(err.message || err);
        }

        deleteRole(projectId, function(err) {
          if (err) {
            debug(err);
            return next(err.message || err);
          }

          deleteForm(projectId, function(err) {
            if (err) {
              debug(err);
              return next(err.message || err);
            }

            next();
          });
        });
      });
    });
  };

  /**
   * Expose the internal functionality for hiding 'deleted' entities.
   */
  return {
    project: deleteProject
  };
};
