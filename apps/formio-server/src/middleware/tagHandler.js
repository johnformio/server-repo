'use strict';
const nodeUrl = require('url');

function getPrimaryProjectId({
  currentProject,
  primaryProject,
  parentProject,
}) {
  // If we are a at tenant's stage, then version tags are based on that tenant.
  if (
    currentProject && currentProject.type === 'stage' &&
    parentProject && parentProject.type === 'tenant'
  ) {
    return parentProject._id;
  }
  // If we are a tenant, then version tags are based on that tenant.
  else if (currentProject && currentProject.type === 'tenant') {
    return currentProject._id;
  }
  return primaryProject._id;
}

/**
 * A handler for tag based requests.
 *
 * @param router
 * @returns {Function}
 */
module.exports = function(router) {
  return function tagHandler(req, res, next) {
    const _url = nodeUrl.parse(req.url).pathname;

    // Allow access to tag/current
    if (req.method === 'GET' && req.projectId && _url === `/project/${req.projectId}/tag/current`) {
      req.skipResource = true;
      return next();
    }

    const primaryProjectId = getPrimaryProjectId(req);

    if (req.method === 'PUT' || req.method === 'POST') {
      req.body.project = primaryProjectId;
    }

    if (req.method === 'GET') {
      req.modelQuery = req.modelQuery || req.model || this.model;
      req.modelQuery = req.modelQuery.find({project: primaryProjectId});

      req.countQuery = req.countQuery || req.model || this.model;
      req.countQuery = req.countQuery.find({project: primaryProjectId});
    }
    return next();
  };
};
