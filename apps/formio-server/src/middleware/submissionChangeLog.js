'use strict';

const _ = require('lodash');
const config = require('../../config');

module.exports = function(app) {
  const getLog = (data) => {
      return _.pick(data, ['_id', '_vuser', '_vnote', 'data', 'metadata.jsonPatch', 'metadata.previousData', 'modified']);
  };

  return async function(req, res, next) {
    if (config.formio.hosted || !_.get(req, 'licenseTerms.options.sac', false)) {
      return next();
    }

    const util = app.formio.formio.util;
    try {
      const submissionRevisionModel = req.submissionRevisionModel ? req.submissionRevisionModel : app.formio.formio.mongoose.models.submissionrevision;
      if (req.query.submissionRevision) {
        const result = await submissionRevisionModel.findOne({
          _id: util.idToBson(req.query.submissionRevision),
          deleted: {$eq: null},
        })
        .exec();
        if (result.metadata.jsonPatch) {
          req.changelog = getLog(result);
        }
        return next();
      }
      else {
        const results = await submissionRevisionModel.find({
          deleted: {$eq: null},
          _rid: util.idToBson(req.params.submissionId)
        })
        .sort('-modified')
        .lean()
        .exec();
        const log = results.reduce((accum, revision)=>{
           if (revision.metadata.jsonPatch) {
            accum.push(getLog(revision));
           }
          return accum;
        }, []);
        if (log.length > 0) {
          req.changelog = log;
        }
        return next();
      }
    }
    catch (err) {
      return next(err);
    }
  };
};
