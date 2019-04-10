'use strict';
const async = require('async');
const util = require('../util/util');

const debug = {
  loadProject: require('debug')('formio:cache:loadProject'),
  error: require('debug')('formio:error')
};

module.exports = function(formio) {
  const formioUtil = formio.util;
  const ProjectCache = {
    loadProjectByName(req, name, cb) {
      const cache = formio.cache.cache(req);
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

        const projectId = project._id.toString();
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
    currentProject(req) {
      const cache = formio.cache.cache(req);
      const id = req.projectId || req.params.projectId;
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
    loadCurrentProject(req, cb) {
      let projectId = req.projectId;
      if (req.params.projectId) {
        projectId = req.params.projectId;
      }
      if (!projectId) {
        return cb('No project found.');
      }
      req.projectId = projectId;
      this.loadProject(req, projectId, cb);
    },

    loadPrimaryProject(req, cb) {
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
    loadProject(req, id, cb) {
      id = formio.util.idToString(id);
      const cache = formio.cache.cache(req);
      if (cache.projects[id]) {
        return cb(null, cache.projects[id]);
      }

      const projectId = formio.util.idToBson(id);
      if (!projectId) {
        return cb('Project not found');
      }

      const query = {_id: projectId, deleted: {$eq: null}};
      const params = req.params;
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
          const currTime = (new Date()).getTime();
          const projTime = (new Date(result.trial.toString())).getTime();
          const delta = Math.ceil(parseInt((currTime - projTime) / 1000));
          const day = 86400;
          const remaining = 30 - parseInt(delta / day);
          const trialDaysRemaining = remaining > 0 ? remaining : 0;

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

    loadStages(req, id, cb) {
      id = formio.util.idToString(id);

      const projectId = formio.util.idToBson(id);
      if (!projectId) {
        return cb('Project not found');
      }

      const query = {project: projectId, deleted: {$eq: null}};
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

  // Override loadSubForms to load revisions if set.
  ProjectCache._loadSubForms = formio.cache.loadSubForms.bind(formio.cache);
  ProjectCache.loadSubForms = function(form, req, next, depth, forms) {
    ProjectCache._loadSubForms(form, req, (err) => {
      if (err) {
        return next(err);
      }

      const comps = {};
      const formRevisions = [];

      // Find any sub forms that have revision locked.
      formioUtil.eachComponent(form.components, function(component) {
        if ((component.type === 'form') && component.form && component.formRevision) {
          const formId = component.form.toString();
          if (!comps[formId]) {
            comps[formId] = [];
            formRevisions.push({
              formId,
              _rid: formId,
              _vid: component.formRevision,
            });
          }
          comps[formId].push(component);
        }
      }, true);

      // Only proceed if we have form revisions.
      if (!formRevisions.length) {
        return next();
      }

      // Set form revision components on sub form.
      async.each(formRevisions, (rev, done) => {
        const query = {
          _rid: formio.util.idToBson(rev._rid),
          _vid: parseInt(rev._vid),
        };
        formio.resources.formrevision.model.findOne(query, function(err, result) {
          if (err && !result) {
            return done();
          }
          comps[rev.formId].forEach((comp) => (comp.components = result.components.toObject()));
          done();
        });
      }, next);
    }, depth, forms);
  };

  return ProjectCache;
};
