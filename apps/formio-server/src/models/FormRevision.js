'use strict';

const mongoose = require('mongoose');

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
      type: mongoose.Schema.Types.Mixed,
      description: 'The version id of the Resource.',
      index: true,
      required: true,
      default: 0
    },
    _vnote: {
      type: String,
      description: 'A note about the version.',
      default: ''
    },
    _vuser: {
      type: String,
      description: 'The user who created the version',
      default: 'anonymous'
    }
  });

  // Remove the name unique validator.
  schema.path('name', {
    validators: schema.obj.name.validators.slice(0, schema.obj.name.validators.length - 2)
  });

  // Remove the path unique validator.
  schema.path('path', {
    validators: schema.obj.path.validators.slice(0, schema.obj.path.validators.length - 2)
  });

  schema.remove('machineName');
  // This removes the machinename index which will throw errors.
  schema._indexes = [];

  return {
    schema: schema
  };
};
