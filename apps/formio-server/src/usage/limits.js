'use strict';

module.exports = {
  basic: {
    forms: 10,
    formRequests: 1000,
    submissionRequests: 1000,
    pdfDownloads: 10,
    pdfs: 1,
    failure: -1
  },
  archived: {
    forms: 10,
    formRequests: 0,
    submissionRequests: 0,
    emails: 0,
    pdfDownloads: 0,
    pdfs: 0,
    failure: -1
  },
  independent: {
    forms: 25,
    formRequests: 10000,
    submissionRequests: 10000,
    failure: 5,
    pdfDownloads: 10,
    pdfs: 1,
  },
  team: {
    forms: 50,
    submissionRequests: 250000,
    formRequests: 250000,
    pdfDownloads: 10,
    pdfs: 1,
    failure: 2
  },
  trial: {
    forms: 10,
    formRequests: 10000,
    submissionRequests: 10000,
    failure: 2
  },
  commercial: {
    submissionRequests: 1000000,
    pdfDownloads: 1000,
    pdfs: 25,
    failure: 1
  }
};
