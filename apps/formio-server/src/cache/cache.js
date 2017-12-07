'use strict';

var debug = {
  loadProject: require('debug')('formio:cache:loadProject'),
  error: require('debug')('formio:error')
};

const util = require('../util/util');

module.exports = function(formio) {
  const ProjectCache = {
    loadProjectByName: function(req, name, cb) {
      var cache = formio.cache.cache(req);
      if (cache.projectNames && cache.projectNames[name]) {
        return this.loadProject(req, cache.projectNames[name], cb);
      }

      // Find the project and cache for later.
      formio.resources.project.model.findOne({
        name: name,
        deleted: {$eq: null}
      }).exec(function(err, project) {
        if (err) {
          return cb(err);
        }
        if (!project) {
          return cb('Project not found');
        }

        var projectId = project._id.toString();
        if (!cache.projectNames) {
          cache.projectNames = {};
        }
        cache.projectNames[name] = projectId;
        cache.projects[projectId] = project;
        cb(null, project);
      });
    },

    /**
     * Returns the current project.
     * @param req
     * @returns {*}
     */
    currentProject: function(req) {
      var cache = formio.cache.cache(req);
      var id = req.projectId || req.params.projectId;
      if (cache.projects[id]) {
        return cache.projects[id];
      }
      return null;
    },

    /**
     * Loads current project.
     * @param req
     * @param cb
     */
    loadCurrentProject: function(req, cb) {
      var projectId = req.projectId;
      if (req.params.projectId) {
        projectId = req.params.projectId;
      }
      if (!projectId) {
        return cb('No project found.');
      }
      req.projectId = projectId;
      this.loadProject(req, projectId, cb);
    },

    loadPrimaryProject: function(req, cb) {
      this.loadCurrentProject(req, function(err, currentProject) {
        if (err) {
          return cb(err);
        }
        // If this is an environment, not a project, load the primary project.
        if ('project' in currentProject && currentProject.project) {
          this.loadProject(req, currentProject.project, function(err, primaryProject) {
            if (err) {
              return cb(err);
            }
            debug.loadProject('Has primary. ', currentProject._id, primaryProject._id);
            return cb(null, primaryProject);
          });
        }
        else {
          debug.loadProject('Is primary. ', currentProject._id);
          return cb(null, currentProject);
        }
      }.bind(this));
    },

    /**
     * Load an Project provided the Project ID.
     * @param req
     * @param id
     * @param cb
     */
    loadProject: function(req, id, cb) {
      id = formio.util.idToString(id);
      var cache = formio.cache.cache(req);
      if (cache.projects[id]) {
        return cb(null, cache.projects[id]);
      }

      let projectId = formio.util.idToBson(id);
      if (!projectId) {
        return cb('Project not found');
      }

      var query = {_id: projectId, deleted: {$eq: null}};
      var params = req.params;
      formio.resources.project.model.findOne(query, function(err, result) {
        // @todo: Figure out why we have to reset the params after project load.
        req.params = params;
        if (err) {
          return cb(err);
        }
        if (!result) {
          return cb('Project not found');
        }
        if (result.plan && result.plan !== 'trial') {
          cache.projects[id] = result;
          return cb(null, result);
        }

        try {
          var currTime = (new Date()).getTime();
          var projTime = (new Date(result.trial.toString())).getTime();
          var delta = Math.ceil(parseInt((currTime - projTime) / 1000));
          var day = 86400;
          var remaining = 30 - parseInt(delta / day);
          var trialDaysRemaining = remaining > 0 ? remaining : 0;

          if (trialDaysRemaining > 0) {
            cache.projects[id] = result;
            return cb(null, result);
          }

          result.set('plan', 'basic');
          result.save(function(err, response) {
            if (err) {
              debug.error(err);
            }

            cache.projects[id] = response;
            return cb(null, response);
          });
        }
        catch (e) {
          debug.error(e);
          cache.projects[id] = result;
          return cb(null, result);
        }
      });
    },

    loadStages: function(req, id, cb) {
      id = formio.util.idToString(id);

      let projectId = formio.util.idToBson(id);
      if (!projectId) {
        return cb('Project not found');
      }

      var query = {project: projectId, deleted: {$eq: null}};
      formio.resources.project.model.find(query, function(err, result) {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    }
  };

  ProjectCache.setSubmissionModel = (req, formId, cb) => {
    formio.cache.loadForm(req, null, formId, function(err, form) {
      if (err) {
        // deliberately do not return an error.
        return cb();
      }

      util.getSubmissionModel(formio, req, form, true, (err, submissionModel) => {
        if (err) {
          return cb(err);
        }

        if (!submissionModel) {
          return cb();
        }

        req.model = req.submissionModel = submissionModel;
        return cb();
      });
    });
  };
  ProjectCache._loadSubmission = formio.cache.loadSubmission.bind(formio.cache);
  ProjectCache.loadSubmission = function(req, formId, subId, cb) {
    ProjectCache.setSubmissionModel(req, formId, (err) => {
      if (err) {
        return cb(err);
      }
      return ProjectCache._loadSubmission(req, formId, subId, cb);
    });
  };

  return ProjectCache;
};
