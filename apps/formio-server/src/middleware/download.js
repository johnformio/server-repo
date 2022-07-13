'use strict';
module.exports = (formioServer) => async (req, res, next) => {
  const downloadPDF = require('../util/downloadPDF')(formioServer);
  const downloadEsign = require('../util/downloadEsign')(formioServer);
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

    if (submission.data.esign && submission.data.esign.fileId) {
      downloadEsign(project, submission)
      .then(async (response) => {
        if (response && response.ok) {
          res.append('Content-Type', response.headers.get('content-type'));
          res.append('Content-Length', response.headers.get('content-length'));
          return response.body.pipe(res);
        }
        else if (response && response.status) {
          return res.status(response.status).send(await response.text());
        }
        else {
          return res.status(400).send(response);
        }
      })
      .catch((err) => res.status(400).send(err.message || err));
    }
    else {
      downloadPDF(req, project, form, submission)
        .then(async (response) => {
          if (response.ok) {
            res.append('Content-Type', response.headers.get('content-type'));
            res.append('Content-Length', response.headers.get('content-length'));
            return response.body.pipe(res);
          }
          else {
            return res.status(response.status).send(await response.text());
          }
        })
        .catch((err) => res.status(400).send(err.message || err));
    }
  }
  catch (err) {
    return next(err);
  }
};
