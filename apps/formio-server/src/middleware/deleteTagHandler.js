'use strict';

const Q = require('q');
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
      return next();
    }

    const query = {_id: formioServer.formio.util.idToBson(req.params.tagId), deleted: {$eq: null}};
    formioServer.formio.resources.tag.model.findOne(query, function(err, tag) {
      if (err) {
        debug(err);
        return next(err.message || err);
      }
      if (!tag) {
        return next();
      }

      formioServer.formio.resources.tag.model.updateMany({
        project: tag.project,
        tag: tag.tag
      },
      {deleted: Date.now()}
      ).then(()=>{
        return res.sendStatus(200);
      })
      .catch(err=>{
        debug(err);
        return next(err.message || err);
      });
    });
  };
};
