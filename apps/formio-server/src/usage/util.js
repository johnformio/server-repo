'use strict';

module.exports = {
  ensureValueIsString: (val) => typeof val !== 'string' ? val.toString() : val,
  determineRequestUsageType: (path) => {
    // Determine the request type
    const form = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}$/;
    const submission = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission(\/[a-f0-9]{24})?$/;
    const pdfDownload = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission(\/[a-f0-9]{24})\/download?$/;
    let type;
    if (submission.test(path)) {
      type = 'submissionRequests';
    }
    else if (form.test(path)) {
      type = 'formRequests';
    }
    else if (pdfDownload.test(path)) {
      type = 'pdfDownloads';
    }

    return type;
  }
};
