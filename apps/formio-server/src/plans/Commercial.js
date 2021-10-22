'use strict';
const Plan = require('./_Plan');

module.exports = class Commercial extends Plan {
  get data() {
    return {
      ...super.data,
      submissionRequests: 1000000,
      emails: 1000,
      pdfDownloads: 1000,
      pdfs: 25,
      stages: 3,
      plan: 'commercial',
    };
  }
};
