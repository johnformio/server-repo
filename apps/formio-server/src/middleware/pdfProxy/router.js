'use strict';

const express = require('express');
const fetch = require('node-fetch');
const config = require('../../../config');
const loadProjectContexts = require('../loadProjectContexts');
const proxy = require('./proxy');

module.exports = (formioServer) => {
  const formio = formioServer.formio;
  const router = express.Router();
  const downloadPDF = require('../../util/downloadPDF')(formioServer);
  router.use(express.raw({type: '*/*', limit: '50mb'}));

  router.use((req, res, next) => {
    const params = formio.util.getUrlParams(req.url);
    if (params.pdf) {
      req.projectId = params.pdf;
    }
    if (req.projectId) {
      loadProjectContexts(formio)(req, res, (err) => {
        if (err) {
          return next(err.message || err);
        }

        if (!req.currentProject) {
          return next('No project found.');
        }

        proxy.authenticate(req, req.currentProject);
        next();
      });
    }
    else {
      return next();
    }
  });

  // Set access-control-allow-headers before removing headers
  router.use((req, res, next) => {
    res.setHeader('access-control-allow-headers', '*');
    next();
  });

  // Keep only essential and user defined headers
  router.use((req, res, next) => {
    proxy.updateHeadersForPdfRequest(req, formio);
    next();
  });

  router.get('/project/:projectId/form/:formId/submission/:submissionId/download', async (req, res) => {
    const project = req.currentProject;
    if (!project) {
      return res.status(400).send('No project found.');
    }
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
  });

  router.use(async (req, res, next) => {
    const options = {
      method: req.method,
      rejectUnauthorized: false,
      headers: req.headers
    };
    if (req.currentProject && req.currentProject.plan) {
      options.headers.plan = req.currentProject.plan;
    }

    const resultUrl = `${req.pdfServer}${req.path}`;
    try {
      if (req.method !== 'HEAD' && req.method !== 'GET') {
        options.body = req.body;
      }
      if (req.url.includes('/download')) {
        options.body = JSON.stringify(req.body);
      }
      const response = await fetch(resultUrl, options);
      const headers = Object.fromEntries(response.headers.entries());

      // If the pdf server returns a file token and our project does not have one, then save it.
      if (req.method === 'GET' && response.ok && config.formio.hosted && req.currentProject) {
        const fileToken = headers['x-file-token'];
        if (fileToken && !req.currentProject.settings.filetoken) {
          req.currentProject.settings.filetoken = fileToken;
          await formio.cache.updateProject(req.currentProject._id, {
            settings: req.currentProject.settings
          });
        }
      }

      res.set(headers);
      res.status(response.status);
      res.end(await response.buffer());
    }
    catch (err) {
      return next(err);
    }
  });

  return router;
};
