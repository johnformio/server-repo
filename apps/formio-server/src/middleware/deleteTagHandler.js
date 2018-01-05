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
  return function(req, res, next) {
    if (req.method !== 'DELETE' || !req.projectId || !req.user._id) {
      debug('Skipping');
      return next();
    }

    const query = {_id: formioServer.formio.util.idToBson(req.params.tagId), deleted: {$eq: null}};
    debug(query);
    formioServer.formio.resources.tag.model.findOne(query, function(err, tag) {
      if (err) {
        debug(err);
        return next(err.message || err);
      }
      if (!tag) {
        debug(`No tag found with _id: ${req.params.tagId}`);
        return next();
      }

      tag.deleted = Date.now();
      tag.markModified('deleted');
      tag.save(err => {
        if (err) {
          return next(err);
        }
        debug('Complete');
        return res.sendStatus(200);
      });
    });
  };
};
