'use strict';

module.exports = app => async (instance, revision, model) => {
  const query = [];
  if (revision.length === 24) {
    query.push({_id: revision});
    if (instance.type === 'form') {
      query.push({revisionId: revision});
    }
  }
  else {
    query.push({
      _rid: instance._id,
      _vid: parseInt(revision, 10)
    });
  }

  return await model.findOne({$or: query}).lean().exec();
};
