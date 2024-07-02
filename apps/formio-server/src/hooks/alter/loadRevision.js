'use strict';

module.exports = app => async (instance, revision, model) => {
  const findRevision = revision.length === 24 ? model.findOne({_id: revision}) : model.findOne({
    _rid: instance._id,
    _vid: parseInt(revision, 10)
  });

  return await findRevision.lean().exec();
};
