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
    async loadProjectByName(req, name) {
      const cache = formio.cache.cache(req);
      if (cache.projectNames && cache.projectNames[name]) {
        return await this.loadProject(req, cache.projectNames[name]);
      }

      // Find the project and cache for later.
      let project = await formio.resources.project.model.findOne({
        name: name,
        deleted: {$eq: null}
      }).exec();
      if (!project) {
        throw new Error('Project not found');
      }

        project = project.toObject();
        const projectId = project._id.toString();
        if (!cache.projectNames) {
          cache.projectNames = {};
        }
        cache.projectNames[name] = projectId;
        cache.projects[projectId] = project;
        loadCache.set(project);
        return project;
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
    async loadCurrentProject(req) {
      const projectId = this.getCurrentProjectId(req);
      if (!projectId) {
        throw new Error('No project found.');
      }
      return await this.loadProject(req, projectId);
    },

    async loadParentProject(req) {
        const currentProject = await this.loadCurrentProject(req);
        // If this is an environment, not a project, load the primary project.
        if ('project' in currentProject && currentProject.project) {
          const parentProject = await this.loadProject(req, currentProject.project);
          debug.loadProject('Has parent. ', currentProject._id, parentProject._id);
          return parentProject;
        }
        else {
          debug.loadProject('Is parent. ', currentProject._id);
          return currentProject;
        }
    },

    async loadPrimaryProject(req) {
        const parentProject = await this.loadParentProject(req);
        if ('project' in parentProject && parentProject.project) {
          const primaryProject = await this.loadProject(req, parentProject.project);
            debug.loadProject('Has primary. ', parentProject._id, primaryProject._id);
            return primaryProject;
        }
        else {
          debug.loadProject('Is primary. ', parentProject._id);
          return parentProject;
        }
    },

    /**
    * Load an Project provided the Project ID.
    * @param req
    * @param id
    */
    async loadProject(req, id) {
      if (!id) {
        throw new Error('Project not found');
      }
      id = formio.util.idToString(id);
      const cache = formio.cache.cache(req);
      if (cache.projects[id]) {
        return cache.projects[id];
      }

      const result = await loadCache.load(id);
      if (!result) {
        if (!config.formio.hosted) {
          const cached = ncache.get(id.toString());
          // Check for cached info.
          if (cached) {
            cached.toObject = function() {
              return this;
            };
          return cached;
          }
          const licenseInfo = await utilizationSync(server, `project:${id}`, {
            licenseKey: server.config.licenseKey,
            type: 'project',
            projectId: id,
            readOnly: true
          });
          if (!licenseInfo) {
            return req.currentProject;
          }
          const project = {
            _id: licenseInfo.projectId,
            plan: licenseInfo.terms.plan,
            owner: req.currentProject ? req.currentProject.owner : null,
          };
          ncache.set(id.toString(), project, CACHE_TIME);
          return project;
          }
          else {
            throw new Error('Project not found');
          }
        }
        cache.projects[id] = result;
        return result;
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

    async updateProject(id, update) {
      let project = await formio.resources.project.model.findOne({
        _id: formio.util.idToBson(id),
        deleted: {$eq: null}
      }).exec();
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

      await formio.resources.project.model.updateOne(
        {_id: project._id},
         project);

      if (update.deleted) {
        project = this.deleteProjectCache(project);
      }
      else {
        project = this.updateProjectCache(project);
       }
      return project;
    },

    async updateCurrentProject(req, update) {
      const projectId = this.getCurrentProjectId(req);
      if (!projectId) {
        return;
      }
      await this.updateProject(projectId, update);
    },

    async loadStages(req, id) {
      id = formio.util.idToString(id);

      const projectId = formio.util.idToBson(id);
      if (!projectId) {
        throw new Error('Project not found');
      }

      const query = {project: projectId, deleted: {$eq: null}};
      const result = await formio.resources.project.model.find(query);
        return result;
    }
  };

  ProjectCache.setSubmissionModel = async (req, formId) => {
    try {
      const form = await formio.cache.loadForm(req, null, formId);
      const submissionModel = await util.getSubmissionModel(formio, req, form, true);
        if (!submissionModel) {
          return null;
        }

        req.model = req.submissionModel = submissionModel;
        return null;
      }
      catch (err) {
        // deliberately do not return an error.
        return null;
      }
  };
  ProjectCache._loadSubmission = formio.cache.loadSubmission.bind(formio.cache);
  ProjectCache.loadSubmission = async function(req, formId, subId) {
      await ProjectCache.setSubmissionModel(req, formId);
      const submission = await ProjectCache._loadSubmission(req, formId, subId);
      return submission;
  };

  ProjectCache.loadCache = loadCache;
  return ProjectCache;
};
