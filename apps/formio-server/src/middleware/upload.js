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
    // const headers = {'x-file-token': project.settings.filetoken};
    const headers = {'x-file-token': 'zstcgHPGpjmCKs1cfeWPNTr8u1TIZK'};

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
    headers['x-jwt-token'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7Il9pZCI6IjU1NjczZGMwNGYwNDA1ZGQyODIwNWJiNyJ9LCJmb3JtIjp7Il9pZCI6IjU1M2RiOTRlNzJmNzAyZTcxNGRkOTc3OSIsInByb2plY3QiOiI1NTNkYjkyZjcyZjcwMmU3MTRkZDk3NzgifSwib3JpZ2luIjoiaHR0cHM6Ly9hcGkuZm9ybS5pbyIsInByb2plY3QiOnsiX2lkIjoiNTUzZGI5MmY3MmY3MDJlNzE0ZGQ5Nzc4In0sImlhdCI6MTU2Mjc3MjA0MiwiZXhwIjoxNTk5MDYwMDQyfQ.v0_y_Q2z-Vk7YGxeh4VAplqZ0hxJAqa3j1QyucyslR4';

    // const pdfProject = project._id.toString();
    filesServer = 'https://files.form.io';
    const pdfProject = '5811179a7fd506006b4a8327';

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
      }, (err) => {
        if (err) {
          res.status(400).send(err.message);
        }
      }).pipe(res);
    }
    catch (err) {
      res.status(400).send(err.message);
    }
  }
  catch (err) {
    return next(err);
  }
};
