'use strict';
const Plan = require('./_Plan');

module.exports = class Basic extends Plan {
  get data() {
    return {
      ...super.data,
      forms: 10,
      formRequests: 1000,
      submissionRequests: 1000,
      emails: 100,
      plan: 'basic',
    };
  }
};
