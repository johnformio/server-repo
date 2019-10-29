'use strict';
const request = require('request');
const FORMIO_FILES_SERVER = process.env.FORMIO_FILES_SERVER || 'https://files.form.io';
const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs');

module.exports = (formioServer) => async(req, res, next) => {
  const formio = formioServer.formio;
  Promise.promisifyAll(formio.cache, {context: formio.cache});

  try {
    // Load project
    const project = await formio.cache.loadPrimaryProjectAsync(req);

    // Set the files server
    let filesServer = FORMIO_FILES_SERVER;
    if (process.env.FORMIO_HOSTED && project.settings.pdfserver) {
      // Allow them to download from any server if it is set to the default
      filesServer = project.settings.pdfserver;
    }

    // Create the headers object
    const headers = {'x-file-token': project.settings.filetoken};

    // Pass along the auth token to files server
    if (req.token) {
      if (req.token.user && req.token.form) {
        headers['x-jwt-token'] = formio.auth.getToken({
          form: req.token.form,
          user: req.token.user,
          project: req.token.project
        });
      }
      else {
        headers['x-jwt-token'] = formio.auth.getToken(_.omit(req.token, 'allow'));
      }
    }
    const pdfProject = project._id.toString();

    if (!req.files.file) {
      return res.status(400).send('Missing file');
    }

    try {
      request({
        method: 'POST',
        url: `${filesServer}/pdf/${pdfProject}/file`,
        headers: headers,
        rejectUnauthorized: false,
        formData: {
          file: {
            value: fs.createReadStream(req.files.file.path),
            options: {
              filename: req.files.file.name,
              contentType: req.files.file.type,
              size: req.files.file.size,
            }
          }
        }
      }, (err, response) => {
        fs.unlink(req.files.file.path);
        if (err) {
          return res.status(400).send(err.message);
        }

        const body = JSON.parse(response.body);
        body.filesServer = filesServer;
        res.status(201).send(body);
      });
    }
    catch (err) {
      fs.unlink(req.files.file.path);
      res.status(400).send(err.message);
    }
  }
  catch (err) {
    fs.unlink(req.files.file.path);
    return next(err);
  }
};
