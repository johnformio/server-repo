'use strict';

const UsageTracking = require('./UsageTracking');

module.exports = function(formio) {
  return new UsageTracking(formio);
};
