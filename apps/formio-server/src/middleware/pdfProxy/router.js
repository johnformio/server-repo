'use strict';

const express = require('express');
const fetch = require('node-fetch');
const _ = require('lodash');
const config = require('../../../config');
const loadProjectContexts = require('../loadProjectContexts');
const download = require('../download');
const debug = require('debug')('formio:pdfproxy');

const PDF_SERVER = process.env.PDF_SERVER || process.env.FORMIO_FILES_SERVER;

module.exports = (formioServer) => {
  const formio = formioServer.formio;
  const router = express.Router();

  router.use(express.raw({type: '*/*', limit: '50mb'}));

  router.use((req, res, next) => {
    debug('Using the PDF proxy');
    req.pdfServer = PDF_SERVER;
    debug('PDF Server set to ', req.pdfServer);
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
        // Set the license key header for authorization.
        req.headers["x-license-key"] = process.env.LICENSE_KEY;

        // It is a problem if the environment variable is not set in hosted. We do not want them to be able to point
        // to arbitrary pdf servers if they are on our hosted environments.
        if (!req.pdfServer && config.formio.hosted) {
          return next('No PDF_SERVER environment configuration.');
        }

        // Always use the environment variable. If it does not exist, then we can try the project settings.

        if (!req.pdfServer && req.currentProject.settings && req.currentProject.settings.pdfserver) {
          req.pdfServer = req.currentProject.settings.pdfserver;
        }
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
    const headers = {};
    _.merge(headers,
      _.pick(req.headers, 'accept', 'content-type', 'accept-encoding', 'accept-language'),
      _.pickBy(req.headers, (_, h) => h.startsWith('x-'))
    );
    req.headers = headers;
    next();
  });

  router.get('/project/:projectId/form/:formId/submission/:submissionId/download', download(formioServer));

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
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
          options.body = JSON.stringify(req.body);
        }
        else {
          options.body = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
        }
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

  router.use((err, req, res) => {
    require('cors')()(req, res, () => res.status(400).send(err.message));
  });

  return router;
};
