"use strict";
const express = require("express");
const fetch = require("node-fetch");
const config = require("../../config");
const loadProjectContexts = require("./loadProjectContexts");

module.exports = (formio) => {
  const router = express.Router();
  router.use(express.json());

  if (config.formio.hosted) {
    router.use((req, res, next) => {
      req.projectId = req.path.split("/")[2];
      next();
    });
    router.use(loadProjectContexts(formio));
  }

  router.use((req, res, next) => {
    if (config.formio.hosted) {
      if (req.currentProject.settings && req.currentProject.settings.filetoken) {
        req.headers["x-file-token"] = req.currentProject.settings.filetoken;
      }
    }
    else {
      req.headers["x-license-key"] = process.env.LICENSE_KEY;
    }
    next();
  });

  router.use(async (req, res) => {
    const options = {
      method: req.method,
      headers: req.headers,
    };
    if (req.method !== "HEAD" && req.method !== "GET") {
      options.body = JSON.stringify(req.body);
    }
    const resultUrl = `${process.env.PDF_SERVER}${req.path}`;
    const response = await fetch(resultUrl, options);
    res.set(Object.fromEntries(response.headers.entries()));
    res.status(response.status);
    res.end(await response.buffer());
  });
  return router;
};

