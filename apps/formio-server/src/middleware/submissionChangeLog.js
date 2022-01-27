'use strict';

const _ = require('lodash');

module.exports = function(app) {
  const getLog = (data) => {
      return _.pick(data, ['_id', '_vuser', '_vnote', 'data', 'metadata.jsonPatch', 'metadata.previousData', 'modified']);
  };

  return function(req, res, next) {
    const util = app.formio.formio.util;
    if (req.query.submissionRevision) {
      app.formio.formio.mongoose.models.submissionrevision.findOne({
        _id: util.idToBson(req.query.submissionRevision),
        deleted: {$eq: null},
      })
      .exec((err, result) => {
        if (err) {
          return next(err);
        }
        if (result.metadata.jsonPatch) {
          req.changelog = getLog(result);
        }
        next();
      });
    }
    else {
      app.formio.formio.mongoose.models.submissionrevision.find({
        deleted: {$eq: null},
        _rid: util.idToBson(req.params.submissionId)
      })
      .sort('-modified')
      .lean()
      .exec((err, results) => {
        if (err) {
          return next(err);
        }
        const log = results.reduce((accum, revision)=>{
           if (revision.metadata.jsonPatch) {
            accum.push(getLog(revision));
           }
          return accum;
        }, []);
        if (log.length > 0) {
          req.changelog = log;
        }
        next();
      });
    }
  };
};
