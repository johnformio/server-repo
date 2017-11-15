'use strict';

var mongoose = require('mongoose');

module.exports = (router, models) => {
  const schema = models.form.schema.clone();

  schema.add({
    _rid: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'The corresponding Resource id of this version.',
      ref:  'forms',
      index: true,
      required: true
    },
    _vid: {
      type: Number,
      description: 'The version id of the Resource.',
      index: true,
      required: true,
      default: 0
    }
  });

  schema.remove('machineName');

  /* eslint-disable new-cap */
  return router.formio.BaseModel({
    schema: schema
  });
};
