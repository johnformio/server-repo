'use strict';

var crypto = require('crypto');
var debug = require('debug')('formio:storage:dropbox');
var request = require('request');
var multer  = require('multer');
var storage = multer.memoryStorage();
var upload = multer({storage: storage});

/* eslint-disable camelcase */
module.exports = function(router) {
  var restrictOwnerAccess = require('../middleware/restrictOwnerAccess')(router.formio.formio);
  var cache = require('../cache/cache')(router.formio.formio);

  // Return necessary settings for making the oauth request to dropbox.
  router.get('/project/:projectId/dropbox/auth',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      debug('Setting project and form ids for get');
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    restrictOwnerAccess,
    function(req, res) {
      if (
        !router.formio.config.dropbox ||
        !router.formio.config.dropbox.clientId
      ) {
        return res.status(400).send('Dropbox Auth not configured');
      }
      res.send({
        response_type: 'code',
        client_id: router.formio.config.dropbox.clientId,
        state: crypto.randomBytes(64).toString('hex')
      });
    }
  );

  // Use the code returned from dropbox to request a token
  router.post('/project/:projectId/dropbox/auth',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      debug('Setting project and form ids for get');
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    restrictOwnerAccess,
    function(req, res) {
      if (req.body.code) {
        // Send code to dropbox for token.
        request.post('https://api.dropboxapi.com/1/oauth2/token', {
          form: {
            code: req.body.code,
            grant_type: 'authorization_code',
            client_id: router.formio.config.dropbox.clientId,
            client_secret: router.formio.config.dropbox.clientSecret,
            redirect_uri: req.body.redirect_uri
          }
        },
        function(error, response, body) {
          if (response.statusCode === 200) {
            var dropbox = JSON.parse(body);
            // return token to app
            res.send(dropbox);

            // Write token to project settings
            cache.loadProject(req, req.projectId, function(err, project) {
              if (!err) {
                // Cannot directly set project.settings.storage.dropbox due to encryption.
                var settings = project.settings;
                if (!settings.storage) {
                  settings.storage = {};
                }
                settings.storage.dropbox = dropbox;
                project.settings = settings;
                project.save();
              }
            });
          }
          else {
            res.status(400).send(error);
          }
        });
      }
      else {
        res.send({});
        // If a code is not sent, this is a disconnect.
        // Write token to project settings
        cache.loadProject(req, req.projectId, function(err, project) {
          if (!err) {
            // Cannot directly set project.settings.storage.dropbox due to encryption.
            var settings = project.settings;
            if (!settings.storage) {
              settings.storage = {};
            }
            settings.storage.dropbox = {};
            project.settings = settings;
            project.save();
          }
        });
      }
    }
  );

  // Get a file from dropbox
  router.get('/project/:projectId/form/:formId/storage/dropbox',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      debug('Setting project and form ids for get');
      if (!req.projectId && req.params.projectId) {
        req.projectId = req.params.projectId;
      }
      if (!req.formId && req.params.formId) {
        req.formId = req.params.formId;
      }
      next();
    },
    router.formio.formio.middleware.permissionHandler,
    function(req, res) {
      debug('Getting dropbox file');
      cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        debug('Project Loaded: ' + req.projectId);
        if (!project.settings.storage || !project.settings.storage.dropbox) {
          return res.status(400).send('Storage settings not set.');
        }
        var path = req.query.path_lower;
        var name = path.split('/').slice(-1)[0];
        request.post('https://content.dropboxapi.com/2/files/download',
          {
            headers: {
              'Authorization': 'Bearer ' + project.settings.storage.dropbox.access_token,
              'Dropbox-API-Arg': JSON.stringify({
                path: path
              })
            },
            encoding: null
          },
          function(error, response, body) {
            if (response.statusCode === 200) {
              var headers = [
                'content-type',
                'content-length',
                'original-content-length',
                'cache-control',
                'pragma',
                'etag',
                'accept-ranges'
              ];
              headers.forEach(function(header) {
                if (response.headers.hasOwnProperty(header)) {
                  res.setHeader(header, response.headers[header]);
                }
              });
              res.setHeader('content-disposition', 'filename=' + name);
              res.send(body);
            }
            else {
              res.status(400).send(error);
            }
          });
      });
    }
  );

  // Send a file to dropbox.
  router.post('/project/:projectId/form/:formId/storage/dropbox',
    router.formio.formio.middleware.tokenHandler,
    function(req, res, next) {
      debug('Setting project and form ids for post');
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
    function(req, res) {
      debug('Sending POST request');
      cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        debug('Project Loaded: ' + req.projectId);
        if (!project.settings.storage ||
          !project.settings.storage.dropbox ||
          !project.settings.storage.dropbox.access_token
        ) {
          return res.status(400).send('Storage settings not set.');
        }

        var fileInfo = req.body;

        // Restrict file uploads to 150MB as this is a limit in Dropbox unless we use a different endpoint.
        if (Buffer.byteLength(req.file.buffer) > 153600) {
          return res.status(413).send('File too large');
        }

        // Stream project to dropbox here.
        request.post('https://content.dropboxapi.com/2/files/upload',
          {
            headers: {
              'Authorization': 'Bearer ' + project.settings.storage.dropbox.access_token,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({
                path: '/' + fileInfo.dir + fileInfo.name,
                mode: 'add',
                autorename: true,
                mute: false
              })
            },
            body: req.file.buffer
          },
          function(error, response, body) {
            if (response.statusCode === 200) {
              var result = JSON.parse(body);
              // return token to app
              res.send(result);
            }
            else {
              res.status(400).send(error);
            }
          });
      });
    }
  );
};
