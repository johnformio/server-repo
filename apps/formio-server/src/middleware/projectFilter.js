'use strict';
const formioUtil = require('formio/src/util/util');

/**
 * Middleware to filter the request, using the project projectId.
 *
 * @returns {Function}
 */
module.exports = function(req, res, next) {
  const projectId = formioUtil.ObjectId(req.projectId || req.params.projectId);

  // Bad request if projectSupport is enabled and no projectId is present.
  if (!projectId) {
    return res.sendStatus(404);
  }

  req.modelQuery = req.modelQuery || req.model || this.model;
  req.modelQuery = req.modelQuery.find({project: projectId});

  req.countQuery = req.countQuery || req.model || this.model;
  req.countQuery = req.countQuery.find({project: projectId});
  next();
};
