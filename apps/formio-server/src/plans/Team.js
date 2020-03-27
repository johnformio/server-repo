'use strict';
const Plan = require('./_Plan');

module.exports = class Team extends Plan {
  get data() {
    return {
      ...super.data,
      forms: 50,
      emails: 1000,
      formRequests: 250000,
      submissionRequests: 250000,
      plan: 'team',
    };
  }
};
