'use strict';
const _ = require('lodash');

module.exports = (router, models) => {
  const formio = router.formio;
  const schema = models.submission.schema.clone();
  schema.paths = _.cloneDeep(schema.paths);

  schema.add({
    _rid: {
      type: formio.mongoose.Schema.Types.ObjectId,
      description: 'The corresponding Resource id of this version.',
      ref:  'submissions',
      index: true,
      required: true
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
    },
  });

  schema.remove('machineName');
  // This removes the machinename index which will throw errors.
  schema._indexes = [];

  return {
    schema: schema
  };
};
