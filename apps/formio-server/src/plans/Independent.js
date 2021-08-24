'use strict';
const Plan = require('./_Plan');

module.exports = class Independent extends Plan {
  get data() {
    return {
      ...super.data,
      forms: 25,
      formRequests: 10000,
      submissionRequests: 10000,
      emails: 100,
      plan: 'independent',
    };
  }
};
