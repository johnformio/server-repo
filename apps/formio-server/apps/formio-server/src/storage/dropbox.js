'use strict';

const crypto = require('crypto');
const fetch = require('@formio/node-fetch-http-proxy');
const multer  = require('multer');
const storage = multer.memoryStorage();
const upload = multer({storage: storage});
const _ = require('lodash');
const FormData = require('form-data');

async function getUrl(options = {}) {
  // Allow options.project as an alternative to options.settings
  if (options.project && !options.settings) {
    options.settings = _.get(options.project, 'settings.storage.dropbox');
  }

  if (!options.settings) {
    throw new Error('Storage settings not set.');
  }

  const path = _.get(options, 'file.path_lower', options.path_lower);

  const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
    headers: {
      'Authorization': `Bearer ${options.settings.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({path})
  });

  if (!response || response.statusCode !== 200) {
    throw new Error('Invalid response.');
  }

  return JSON.parse(response.body).link;
}

/* eslint-disable camelcase */
const middleware = router => {
  const restrictProjectAccess = require('../middleware/restrictProjectAccess')(router.formio.formio);

  // Return necessary settings for making the oauth request to dropbox.
  router.get('/project/:projectId/dropbox/auth',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    restrictProjectAccess({level: 'admin'}),
    function(req, res) {
      if (!process.env.DROPBOX_CLIENTID) {
        return res.status(400).send('Dropbox Auth not configured');
      }
      res.send({
        response_type: 'code',
        client_id: process.env.DROPBOX_CLIENTID,
        state: crypto.randomBytes(64).toString('hex')
      });
    }
  );

  // Use the code returned from dropbox to request a token
  router.post('/project/:projectId/dropbox/auth',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    restrictProjectAccess({level: 'admin'}),
    function(req, res) {
      if (req.body.code) {
        const form = new FormData();
        form.append('code', req.body.code);
        form.append('grant_type', 'authorization_code');
        form.append('client_id', process.env.DROPBOX_CLIENTID);
        form.append('client_secret', process.env.DROPBOX_CLIENTSECRET);
        form.append('redirect_uri', req.body.redirect_uri);
        // Send code to dropbox for token.
        fetch('https://api.dropboxapi.com/1/oauth2/token', {
          method: 'post',
          body: form,
        })
          .then((response) => response.ok ? response.json() : null)
          .then((dropbox) => {
            if (!dropbox) {
              return res.status(400).send('Invalid response.');
            }

            // return token to app
            res.send(dropbox);

            // Write token to project settings
            router.formio.formio.cache.updateProject(req.projectId, {storage: {dropbox}});
          });
      }
      else {
        res.send({});

        // If a code is not sent, this is a disconnect.
        router.formio.formio.cache.updateProject(req.projectId, {storage: {dropbox: {}}});
      }
    }
  );

  // Get a file from dropbox
  router.get('/project/:projectId/form/:formId/storage/dropbox',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    router.formio.formio.middleware.permissionHandler,
    async function(req, res) {
      try {
        const project = await router.formio.formio.cache.loadProject(req, req.projectId);

        if (!project.settings.storage || !project.settings.storage.dropbox) {
          return res.status(400).send('Storage settings not set.');
        }
        const path = req.query.path_lower;
        const name = path.split('/').slice(-1)[0];
        fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${project.settings.storage.dropbox.access_token}`,
            'Dropbox-API-Arg': JSON.stringify({
              path: path
            })
          },
        })
          .then((response) => {
            if (response.ok) {
              const headers = [
                'content-type',
                'content-length',
                'original-content-length',
                'cache-control',
                'pragma',
                'etag',
                'accept-ranges'
              ];
              headers.forEach(function(header) {
                if (response.headers.get(header)) {
                  res.setHeader(header, response.headers.get(header));
                }
              });
              res.setHeader('content-disposition', `filename=${name}`);
              return response.body.pipe(res);
            }
            else {
              return res.status(400).send('Invalid response.');
            }
          });
      }
      catch (err) {
        return res.status(400).send('Project not found.');
      }
    }
  );

  // Send a file to dropbox.
  router.post('/project/:projectId/form/:formId/storage/dropbox',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    router.formio.formio.middleware.permissionHandler,
    upload.single('file'),
    async function(req, res) {
      try {
        const project = await router.formio.formio.cache.loadProject(req, req.projectId);

        if (!project.settings.storage ||
          !project.settings.storage.dropbox ||
          !project.settings.storage.dropbox.access_token
        ) {
          return res.status(400).send('Storage settings not set.');
        }

        const fileInfo = req.body;

        // Restrict file uploads to 150MB as this is a limit in Dropbox unless we use a different endpoint.
        if (Buffer.byteLength(req.file.buffer) > 157286400) {
          return res.status(413).send('File too large');
        }

        // Stream project to dropbox here.
        fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${project.settings.storage.dropbox.access_token}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              path: `/${fileInfo.dir}${fileInfo.name}`,
              mode: 'add',
              autorename: true,
              mute: false
            })
          },
          body: req.file.buffer,
        })
          .then((response) => response.ok ? response.json() : null)
          .then((body) => {
            if (!body) {
              return res.status(400).send('Invalid response.');
            }

            res.send(body);
          });
      }
      catch (err) {
        return res.status(400).send('Project not found.');
      }
    }
  );
};

module.exports = {
  middleware,
  getUrl
};
