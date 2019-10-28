'use strict';
const properties = require('../../actions/properties');

module.exports = app => propertyActions => {
  return {
    ...propertyActions,
    ...properties(app),
  };
};
