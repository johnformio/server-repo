'use strict';
module.exports = (formioServer) => async (req, res, next) => {
  const downloadPDF = require('../util/downloadPDF')(formioServer);
  const formio = formioServer.formio;
  try {
    const project = req.currentProject;
    const formId = req.query.form || formio.cache.getCurrentFormId(req);
    const form = await formio.cache.loadFormAsync(req, null, formId);
    let submission;
    if (req.subId) {
      submission = req.query.submissionRevision? await formio.cache.loadSubmissionRevisionAsync(req)
        : await formio.cache.loadCurrentSubmissionAsync(req);
    }
    else {
      submission = req.body;
    }

    downloadPDF(req, project, form, submission)
      .catch((err) => res.status(400).send(err.message || err))
      .then(async (response) => {
        if (response.ok) {
          res.append('Content-Type', response.headers.get('content-type'));
          res.append('Content-Length', response.headers.get('content-length'));
          return response.body.pipe(res);
        }
        else {
          return res.status(response.status).send(await response.text());
        }
      });
  }
  catch (err) {
    return next(err);
  }
};
