"use strict";
const express = require("express");
const fetch = require("node-fetch");
const config = require("../../config");
const loadProjectContexts = require("./loadProjectContexts");
const PDF_SERVER = process.env.PDF_SERVER || process.env.FORMIO_FILES_SERVER;
module.exports = (formio) => {
  const router = express.Router();
  router.use(express.json());

  router.use((req, res, next) => {
    req.pdfServer = PDF_SERVER;
    const params = formio.util.getUrlParams(req.url);
    if (params.pdf) {
      req.projectId = params.pdf;
    }
    if (req.projectId) {
      loadProjectContexts(formio)(req, res, (err) => {
        if (err) {
          return next(err);
        }
        if (config.formio.hosted) {
          // Hosted projects use the x-file-token for pdf server communication.
          if (req.currentProject.settings && req.currentProject.settings.filetoken) {
            req.headers["x-file-token"] = req.currentProject.settings.filetoken;
          }

          // It is a problem if the environment variable is not set in hosted. We do not want them to be able to point
          // to arbitrary pdf servers if they are on our hosted environments.
          if (!req.pdfServer) {
            return next('No PDF_SERVER environment configuration.');
          }
        }
        else {
          // Set the license key header for authorization.
          req.headers["x-license-key"] = process.env.LICENSE_KEY;

          // Always use the environment variable. If it does not exist, then we can try the project settings.
          if (!req.pdfServer && req.currentProject.settings && req.currentProject.settings.pdfserver) {
            req.pdfServer = req.currentProject.settings.pdfserver;
          }
        }
        return next();
      });
    }
  });

  router.use(async (req, res) => {
    const options = {
      method: req.method,
      headers: req.headers,
    };
    if (req.method !== 'HEAD' && req.method !== 'GET') {
      options.body = JSON.stringify(req.body);
    }
    const resultUrl = `${req.pdfServer}${req.path}`;
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
  });
  return router;
};
