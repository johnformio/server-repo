'use strict';
const util = require('../util/util');
const {utilization} = require('../util/utilization');
const NodeCache = require('node-cache');
const ncache = new NodeCache();

const CACHE_TIME =  process.env.FORMIO_HOSTED ? 0 : process.env.CACHE_TIME || 3 * 60 * 60;

const debug = {
  loadProject: require('debug')('formio:cache:loadProject'),
  error: require('debug')('formio:error')
};

module.exports = function(server) {
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
      if (!projectId && req.body.project) {
        projectId = req.body.project;
      }
      if (!projectId) {
        return cb('No project found.');
      }
      req.projectId = projectId;
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
          if (!process.env.FORMIO_HOSTED) {
            const cached = ncache.get(id.toString());
            // Check for cached info.
            if (cached) {
              cached.toObject = function() {
                return this;
              };
              return cb(null, cached);
            }
            return utilization({
              licenseKey: server.config.licenseKey,
              type: 'project',
              projectId: id,
              readOnly: true
            })
              .then((licenseInfo) => {
                const project = {
                  _id: licenseInfo.projectId,
                  plan: licenseInfo.terms.plan,
                  owner: req.currentProject ? req.currentProject.owner : null,
                };
                ncache.set(id.toString(), project, CACHE_TIME);
                project.toObject = function() {
                  return this;
                };
                return cb(null, project);
              })
              .catch(cb);
          }
          else {
            return cb('Project not found');
          }
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

  return ProjectCache;
};
