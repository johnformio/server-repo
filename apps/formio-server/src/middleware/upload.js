'use strict';
const fetch = require('formio/src/util/fetch');
const {promisify} = require('util');
const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs');
const {getLicenseKey} = require('../util/utilization');
const {getPDFUrls} = require('../util/pdf');
const debug = require('debug')('formio:pdf:upload');
const FormData = require('form-data');

const unlinkAsync = promisify(fs.unlink);

const tryUnlinkAsync = async filepath => {
  try {
    return await unlinkAsync(filepath);
  }
  catch (err) {
    return err;
  }
};

module.exports = (formioServer) => async (req, res, next) => {
  debug('Starting pdf upload');
  const formio = formioServer.formio;
  Promise.promisifyAll(formio.cache, {context: formio.cache});

  try {
    // Load project
    const project = req.currentProject;

    // Set the files server
    const pdfUrls = getPDFUrls(project);
    debug(`FileServer: ${pdfUrls.local}`);

    // Create the headers object
    const headers = {'x-license-key': getLicenseKey(req)};

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
    debug(`LicenseKey: ${headers['x-license-key']}`);
    const pdfProject = project._id.toString();
    debug(`pdfProject: ${pdfProject}`);

    if (!req.files || !req.files.file) {
      debug('Missing File');
      return res.status(400).send('Missing file');
    }

    try {
      debug('POST: ' + `${pdfUrls.local}/pdf/${pdfProject}/file`);
      debug(`Filepath: ${  req.files.file.path}`);
      const form = new FormData();
      form.append('file', fs.createReadStream(req.files.file.path), {
        filename: req.files.file.name,
        contentType: req.files.file.type,
        size: req.files.file.size,
      });
      req.setTimeout(0);
      fetch(`${pdfUrls.local}/pdf/${pdfProject}/file`, {
        method: 'POST',
        headers: headers,
        body: form,
        rejectUnauthorized: false
      })
        .catch(async (err) => {
          debug('unlinked file');
          debug('Err1', err);
          await tryUnlinkAsync(req.files.file.path);
          res.status(400).send(err.message || err);
          throw err;
        })
        .then(async (response) => {
          if (response.ok) {
            const body = await response.json();
            body.filesServer = pdfUrls.public;
            return res.status(201).send(body);
          }
          else {
            return res.status(response.status).send(await response.text());
          }
        });
    }
    catch (err) {
      debug('Err2', err);
      await tryUnlinkAsync(req.files.file.path);
      res.status(400).send(err.message);
    }
  }
  catch (err) {
    debug('Err3', err);
    await tryUnlinkAsync(req.files.file.path);
    return next(err);
  }
};
