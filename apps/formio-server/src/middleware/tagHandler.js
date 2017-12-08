'use strict';
var nodeUrl = require('url');

/**
 * A handler for form based requests.
 *
 * @param router
 * @returns {Function}
 */
module.exports = function(router) {
  return function tagHandler(req, res, next) {
    var _url = nodeUrl.parse(req.url).pathname;

    // Allow access to tag/current
    if (req.method === 'GET' && req.projectId && _url === '/project/' + req.projectId + '/tag/current') {
      req.skipResource = true;
      return next();
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      req.body.project = req.primaryProject._id;
    }

    if (req.method === 'GET') {
      req.modelQuery = req.modelQuery || req.model || this.model;
      req.modelQuery = req.modelQuery.find({project: req.primaryProject._id});

      req.countQuery = req.countQuery || req.model || this.model;
      req.countQuery = req.countQuery.find({project: req.primaryProject._id});
    }
    return next();
  };
};
