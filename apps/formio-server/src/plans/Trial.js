'use strict';
const Plan = require('./_Plan');

module.exports = class Trial extends Plan {
  get data() {
    return {
      ...super.data,
      forms: 10,
      formRequests: 10000,
      submissionRequests: 10000,
      emails: 100,
      stages: 10,
      plan: 'trial',
    };
  }

  getPlan() {
    const data = super.getPlan();
    const expire = new Date();
    expire.setMonth(expire.getMonth() + 1);
    data.endDate = expire.toISOString();
    return data;
  }
};
