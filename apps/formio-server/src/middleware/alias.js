'use strict';

const config = require('../../config');
const tld = require('tldjs');
const debug = {
  alias: require('debug')('formio:alias')
};

/**
 * Provides URL alias capabilities.
 *
 * Middleware to resolve a form alias into its components.
 */
module.exports = function(formio) {
  // Skip the alias handler.
  const skip = function(req, res, next) {
    const params = formio.util.getUrlParams(req.url);
    if (params.project) {
      req.projectId = params.project;
    }
    return next();
  };

  // Handle the request.
  return async function(req, res, next) {
    // Determine if this is a local domain or not.
    let local = false;

    // Ignore the subdomain if they provide the config.
    if (config.noalias) {
      return skip(req, res, next);
    }

    // If /project/ is the start of the url, skip aliasing.
    if (req.url.indexOf('/project/') === 0) {
      return skip(req, res, next);
    }

    // Get the hostname.
    let hostname = req.hostname;
    if (!hostname) {
      return skip(req, res, next);
    }

    // Strip off the port number if present.
    hostname = hostname.split(':')[0];

    // Determine if localhost and cleanup hostname.
    if ((hostname.indexOf('127.0.0.1') !== -1) || (hostname.indexOf('localhost') !== -1)) {
      local = true;
      hostname = hostname.replace('127.0.0.1', 'localhost');
    }

    // Determine if there is a subdomain, and break it down to the Project name.
    const subdomain = tld.getSubdomain(hostname);
    let projectName = null;

    // Handle edge-cases for local connections.
    if (local) {
      // Trim the subdomain to the left-most portion for the Project name.
      if (hostname.split('.').length > 1) {
        projectName = hostname.split('.')[0];
      }
    }
    // Use the given address to trim the Project name from the subdomain.
    else if (subdomain) {
      // Trim the subdomain to the left-most portion for the Project name.
      projectName = subdomain.split('.').length > 1
        ? projectName = subdomain.split('.')[0]
        : subdomain;
    }

    // Quick confirmation that we have an projectName.
    if (projectName && !isNaN(projectName)) {
      return skip(req, res, next);
    }

    const checkSubDomain = async () => {
      // Allow using subdomains as subdirectories as well.
      const subdirectory = req.url.split('/')[1];
      // Quick confirmation that we have an projectName.
      if (subdirectory === 'api' || config.reservedSubdomains.indexOf(subdirectory) !== -1) {
        return next();
      }
      else {
        try {
          const project = await formio.cache.loadProjectByName(req, subdirectory);
          debug.alias(`Loading project from subdir: ${projectName}`);

          if (!project) {
            return next();
          }

          // Set the Project Id in the request.
          req.projectId = project._id.toString();
          req.url = `/project/${project._id}${req.url.slice(subdirectory.length + 1)}`;
          return next();
      }
      catch (err) {
        return next();
      }
    }
  };

    if (!projectName) {
      return await checkSubDomain();
    }

    // Look up the subdomain.
    try {
      const project = await formio.cache.loadProjectByName(req, projectName);
      debug.alias(`Loading project: ${projectName}`);

      if (!project) {
        // If project is not found by subdomain, check if the directory refers to the project.
          return await checkSubDomain();
      }
      else {
        // Set the Project Id in the request.
        req.projectId = project._id.toString();
        req.url = `/project/${project._id}${req.url}`;
        return next();
      }
    }
    catch (err) {
      debug.alias(`Loading project: ${projectName}`);

      // If project is not found by subdomain, check if the directory refers to the project.
      if (err.message === 'Project not found') {
        return await checkSubDomain();
      }
      else {
        return next();
      }
    }
  };
};
