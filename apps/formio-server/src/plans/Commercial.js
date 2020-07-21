'use strict';
const Plan = require('./_Plan');

module.exports = class Commercial extends Plan {
  get data() {
    return {
      ...super.data,
      submissionRequests: 2000000,
      emails: 10000,
      pdfDownloads: 1000,
      pdfs: 25,
      stages: 5,
      livestages: 2,
      plan: 'commercial',
    };
  }
};
