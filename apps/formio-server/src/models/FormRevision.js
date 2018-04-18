'use strict';

const mongoose = require('mongoose');
const _ = require('lodash');

module.exports = (router, models) => {
  const schema = models.form.schema.clone();
  schema.paths = _.cloneDeep(schema.paths);

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

  /**
   * Removes unique validators.
   *
   * @param property
   */
  const removeUniqueValidator = function(property) {
    // Remove the name unique validator.
    const propModifier = {};
    if (schema.obj[property].validators) {
      propModifier.validators = schema.obj[property].validators;
      _.remove(propModifier.validators, (validator) => {
        return (_.get(validator, 'message', '').indexOf('must be unique') !== -1);
      });
    }
    else if (schema.paths[property].validators) {
      // Schema clone apparently does not properly clone path validators.
      propModifier.validators = schema.paths[property].validators;
      _.remove(propModifier.validators, (validator) => {
        return (_.get(validator, 'message', '').indexOf('must be unique') !== -1);
      });
    }
    else {
      /* eslint-disable no-console */
      console.warn('Cannot find validators on Form schema.');
      /* eslint-enable no-console */
    }
  };

  removeUniqueValidator('name');
  removeUniqueValidator('path');

  schema.remove('machineName');
  // This removes the machinename index which will throw errors.
  schema._indexes = [];

  return {
    schema: schema
  };
};
