'use strict';

const debug = require('debug')('formio:middleware:deleteTagHandler');

/**
 * The deleteTagHandler middleware.
 *
 * This middleware is used for flagging Tags as deleted rather than actually deleting them.
 *
 * @param router
 * @returns {Function}
 */
module.exports = function(formio, formioServer) {
  return async function(req, res, next) {
    if (req.method !== 'DELETE' || !req.projectId || !req.user._id) {
      return next();
    }

    const query = {
      _id: formioServer.formio.util.idToBson(req.params.tagId),
      deleted: {$eq: null},
      project: req.currentProject.project || req.currentProject._id
    };
    try {
      const tag = await formioServer.formio.resources.tag.model.findOne(query);
      if (!tag) {
        return next(new Error('Could not find the tag'));
      }

      await formioServer.formio.resources.tag.model.updateMany({
        project: tag.project,
        tag: tag.tag
      },
      {deleted: Date.now()}
      );
      return res.sendStatus(200);
    }
    catch (err) {
      debug(err);
      return next(err.message || err);
    }
  };
};
