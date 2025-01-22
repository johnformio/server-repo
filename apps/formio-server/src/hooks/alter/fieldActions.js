'use strict';
const fields = require('../../actions/fields');

module.exports = app => fieldActions => {
  return {
    ...fieldActions,
    ...fields(app),
  };
};
