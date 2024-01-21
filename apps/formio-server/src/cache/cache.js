'use strict';
const util = require('../util/util');
const {utilizationSync} = require('../util/utilization');
const config = require('../../config');
const NodeCache = require('node-cache');
const ncache = new NodeCache();
const projectCache = require('./projectCache');
const CACHE_TIME = process.env.CACHE_TIME || 15 * 60;
const _ = require('lodash');

const debug = {
  loadProject: require('debug')('formio:cache:loadProject'),
  error: require('debug')('formio:error')
};

module.exports = function(server) {
  const loadCache = projectCache(server.formio);
  const formio = server.formio;
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

        project = project.toObject();
        const projectId = project._id.toString();
        if (!cache.projectNames) {
          cache.projectNames = {};
        }
        cache.projectNames[name] = projectId;
        cache.projects[projectId] = project;
        loadCache.set(project);
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

    getCurrentProjectId(req) {
      let projectId = req.projectId;
      if (req.params.projectId) {
        projectId = req.params.projectId;
      }
      if (!projectId && req.body && req.body.project) {
        projectId = req.body.project;
      }
      if (!projectId) {
        return '';
      }
      req.projectId = projectId;
      return req.projectId;
    },

    /**
    * Loads current project.
    * @param req
    * @param cb
    */
    loadCurrentProject(req, cb) {
      const projectId = this.getCurrentProjectId(req);
      if (!projectId) {
        return cb('No project found.');
      }
      this.loadProject(req, projectId, cb);
    },

    loadParentProject(req, cb) {
      this.loadCurrentProject(req, function(err, currentProject) {
        if (err) {
          return cb(err);
        }
        // If this is an environment, not a project, load the primary project.
        if ('project' in currentProject && currentProject.project) {
          this.loadProject(req, currentProject.project, function(err, parentProject) {
            if (err) {
              return cb(err);
            }
            debug.loadProject('Has parent. ', currentProject._id, parentProject._id);
            return cb(null, parentProject);
          });
        }
        else {
          debug.loadProject('Is parent. ', currentProject._id);
          return cb(null, currentProject);
        }
      }.bind(this));
    },

    loadPrimaryProject(req, cb) {
      this.loadParentProject(req, (err, parentProject) => {
        if (err) {
          return cb(err);
        }
        if ('project' in parentProject && parentProject.project) {
          this.loadProject(req, parentProject.project, function(err, primaryProject) {
            if (err) {
              return cb(err);
            }
            debug.loadProject('Has primary. ', parentProject._id, primaryProject._id);
            return cb(null, primaryProject);
          });
        }
        else {
          debug.loadProject('Is primary. ', parentProject._id);
          return cb(null, parentProject);
        }
      });
    },

    /**
    * Load an Project provided the Project ID.
    * @param req
    * @param id
    * @param cb
    */
    loadProject(req, id, cb) {
      if (!cb) {
        cb = (err, result) => new Promise((resolve, reject) => (err ? reject(err) : resolve(result)));
      }
      if (!id) {
        return cb('Project not found');
      }
      id = formio.util.idToString(id);
      const cache = formio.cache.cache(req);
      if (cache.projects[id]) {
        return cb(null, cache.projects[id]);
      }

      loadCache.load(id, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (!result) {
          if (!config.formio.hosted) {
            const cached = ncache.get(id.toString());
            // Check for cached info.
            if (cached) {
              cached.toObject = function() {
                return this;
              };
              return cb(null, cached);
            }
            return utilizationSync(server, `project:${id}`, {
              licenseKey: server.config.licenseKey,
              type: 'project',
              projectId: id,
              readOnly: true
            })
            .then((licenseInfo) => {
              if (!licenseInfo) {
                return cb(null, req.currentProject);
              }
              const project = {
                _id: licenseInfo.projectId,
                plan: licenseInfo.terms.plan,
                owner: req.currentProject ? req.currentProject.owner : null,
              };
              ncache.set(id.toString(), project, CACHE_TIME);
              return cb(null, project);
            })
            .catch(cb);
          }
          else {
            return cb('Project not found');
          }
        }

        cache.projects[id] = result;
        return cb(null, result);
      });
    },

    deleteProjectCache(project) {
      try {
        project = project.toObject();
      }
      catch (err) {
        // project is already an object.
      }
      loadCache.clear(project);
      return project;
    },

    updateProjectCache(project) {
      try {
        project = project.toObject();
      }
      catch (err) {
        // project is already an object.
      }
      loadCache.set(project);
      return project;
    },

    updateProject(id, update, cb) {
      return formio.resources.project.model.findOne({
        _id: formio.util.idToBson(id),
        deleted: {$eq: null}
      }).exec().then((project) => {
        if (update.settings) {
          const currentSettings = project.settings;
          project.settings = _.merge(currentSettings, update.settings);
          project.markModified('settings');
          delete update.settings;
        }
        for (const prop in update) {
          if (prop !== 'modified') {
            project[prop] = update[prop];
          }
          project.markModified(prop);
        }
        return project.save().then(() => {
          if (update.deleted) {
            project = this.deleteProjectCache(project);
          }
          else {
            project = this.updateProjectCache(project);
          }
          if (cb) {
            return cb(null, project);
          }
          return project;
        }).catch((err) => {
          if (cb) {
            return cb(err);
          }
        });
      }).catch((err) => {
        if (cb) {
          return cb(err);
        }
      });
    },

    updateCurrentProject(req, update, cb) {
      const projectId = this.getCurrentProjectId(req);
      if (!projectId) {
        if (cb) {
          return cb('No project found.');
        }
        return;
      }
      this.updateProject(projectId, update, cb);
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

  ProjectCache.loadCache = loadCache;
  return ProjectCache;
};
