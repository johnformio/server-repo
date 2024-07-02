'use strict';

const debug = require('debug')('formio:resources:tag');
const _ = require('lodash');

module.exports = (formio) => async (req, res, next) => {
  if (res.resource && (res.resource.status===200 || res.resource.status===201)) {
    const {project, tag} = res.resource.item;
    try {
      const chunks = await formio.mongoose.model('tag').find({project, tag, deleted: null, chunk: true});
      _.merge(res.resource.item.template, ...chunks.map(chunk=>chunk.template));
      return next();
    }
    catch (err) {
      debug(err);
      return res.status(400).send(err);
    }
  }
  else {
    return next();
  }
};
