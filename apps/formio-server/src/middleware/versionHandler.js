'use strict';
var nodeUrl = require('url');

/**
 * A handler for form based requests.
 *
 * @param router
 * @returns {Function}
 */
module.exports = function(router) {
  return function versionHandler(req, res, next) {
    var _url = nodeUrl.parse(req.url).pathname;

    // Allow access to version/current
    if (req.method === 'GET' && req.projectId && _url === '/project/' + req.projectId + '/version/current') {
      req.skipResource = true;
      return next();
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      req.body.project = req.primaryProject._id;
    }

    if (req.method === 'GET') {
      req.modelQuery = req.modelQuery || this.model;
      req.modelQuery = req.modelQuery.find({project: req.primaryProject._id});

      req.countQuery = req.countQuery || this.model;
      req.countQuery = req.countQuery.find({project: req.primaryProject._id});
    }
    return next();
  };
};
