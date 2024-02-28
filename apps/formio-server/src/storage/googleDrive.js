'use strict';

const multer  = require('multer');
const storage = multer.memoryStorage();
const upload = multer({storage: storage});
const _ = require('lodash');
const {google} = require('googleapis');
const debug = require('debug')('formio:storage:googledrive');
const Stream = require('stream');

function hasValidProviderSettings(settings) {
  return settings.google
    && settings.google.clientId
    && settings.google.cskey
    && settings.google.refreshtoken;
}

async function getContentUrl(options = {}) {
  let {settings} = options;
  const {project, file, id} = options;
  if (project && !settings) {
    settings = _.get(project, 'settings.storage.googleDrive');
  }

  if (!settings) {
    throw new Error('Storage settings not set.');
  }

  let {drive} = options;
  if (!drive && hasValidProviderSettings(project.settings)) {
    drive = await authenticate(project.settings);
  }

  const fileId = file?.id || id;
  debug('Getting a Google Drive content link for the file.');

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'webContentLink',
    });
    return {
      url: response.data.webContentLink,
      key: fileId,
    };
  }
  catch (error) {
    debug(error);
    throw new Error('Invalid response');
  }
}

async function getUrl(options = {}) {
  if (options.fromAction) {
    return await getContentUrl(options);
  }

  // Allow options.project as an alternative to options.settings
  if (options.project && !options.settings) {
    options.settings = _.get(options.project, 'settings.storage.googleDrive');
  }

  if (!options.settings) {
    throw new Error('Storage settings not set.');
  }

  const {drive} = options;

  if (!drive) {
    throw new Error('Drive not provided.');
  }

  const fileId = _.get(options, 'file.id', options.id);

  let link;

  debug('Getting a Google Drive link for the uploaded file.');

  // set permission to te file to allow read it by link
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'anyone',
        withLink: true,
        role: 'reader',
      }
    });

    link = await drive.files.get({
      fileId,
      fields: 'webViewLink'
    })
      .then((res) => res.data.webViewLink);

      debug('Got a Google Drive link for the uploaded file.');
  }
  catch (error) {
    debug(error);
    throw new Error('Invalid response.');
  }

  if (!link) {
    throw new Error('Invalid response.');
  }

  return {
    url: link,
    key: fileId,
  };
}

// Authentication method for Google Drive
function authenticate(settings) {
  const config = {
    client_id: _.get(settings, 'google.clientId'), // eslint-disable-line camelcase
    client_secret: _.get(settings, 'google.cskey'), // eslint-disable-line camelcase
    refresh_token: _.get(settings, 'google.refreshtoken') // eslint-disable-line camelcase
  };

  return new Promise((resolve, reject) => {
    try {
      // Authenticate with OAuth2.
      const oauth2Client = new google.auth.OAuth2(
        config.client_id,
        config.client_secret,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      oauth2Client.setCredentials({
        refresh_token: config.refresh_token // eslint-disable-line camelcase
      });
      debug('Authenticating with Google');
      oauth2Client.getAccessToken()
        .then(() => {
          debug('Authentication complete.');
          resolve(google.drive({
            version: 'v3',
            auth: oauth2Client
          }));
        })
        .catch((err) => {
          debug(err);
          reject(err);
        });
    }
    catch (err) {
      debug(err);
      reject(err);
    }
  });
}

/* eslint-disable camelcase */
const middleware = router => {
  const restrictProjectAccess = require('../middleware/restrictProjectAccess')(router.formio.formio);

  // Switch on/off the Google Drive
  router.post('/project/:projectId/gdrive/auth',
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
      if (req.body.enable) {
        debug('Switching on Google Drive.');
        // Swith on the Google Drive
        router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
          if (err) {
            debug(err);
            return res.status(400).send('No project found');
          }

          const {settings} = project;
          // Use the Google Drive Data connection integration settings
          if (!hasValidProviderSettings(settings)) {
            return res.status(400).send('Google Drive Settings not configured. Please go to Data Connections');
          }

          authenticate(settings)
          .then(async (drive) => {
            debug('Checking scope permission for Google Drive.');

            // Check if a scope has permissions for the Google Drive
            await drive.files.list({
              pageSize: 1
            });

            debug('Checked scope permission for Google Drive.');

            // If has permissions for the Google Drive, response with enabled.
            res.send({enabled: true});
            router.formio.formio.cache.updateProject(project._id, {
              settings: {
                storage: {googleDrive: true}
              }
            });
            debug('Switched on Google Drive.');
          })
          .catch((err) => {
            debug(err);
            res.status(400).send(`Incorrect Google Drive credantials. ${err.message || ''}`);
          });
        });
      }
      else {
        debug('Switched off Google Drive.');

        // Swith off the Google Drive
        res.send({});
        router.formio.formio.cache.updateProject(req.projectId, {
          settings: {
            storage: {googleDrive: null}
          }
        });
      }
    }
  );

  // Get a file from the Google Drive
  router.get('/project/:projectId/form/:formId/storage/gdrive',
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
    router.formio.formio.plans.disableForPlans(['basic', 'independent', 'archived']),
    function(req, res) {
      router.formio.formio.cache.loadProject(req, req.projectId, async function(err, project) {
        if (err) {
          debug(err);
          return res.status(400).send('Project not found.');
        }

        const {settings} = project;

        if (!settings.storage) {
          settings.storage = {};
        }

        if (!settings.storage.googleDrive || !hasValidProviderSettings(settings)) {
          return res.status(400).send('Google Drive Settings not configured. Please go to Data Connections');
        }

        const {fileId, fileName} = req.query;

        const getWebViewLink = async (drive, fileId) => {
          try {
            debug(`Getting a web view link for file ${fileId} from Google Drive`);

            const fileMetadata = await drive.files.get({
              fileId,
              fields: 'name,webViewLink',
            });

            return fileMetadata.data?.webViewLink;
          }
          catch (err) {
            debug(`Error getting web view link: ${err.message}`);
            return null;
          }
        };

        try {
          const drive = await authenticate(settings);
          const webViewLink = await getWebViewLink(drive, fileId);
          if (webViewLink) {
            return res.redirect(webViewLink);
          }

          debug(`Loading a file ${fileId} from Google Drive.`);

          const response = await drive.files.get(
            {
              fileId,
              alt: 'media',
            },
            {responseType: 'stream'}
          );
          // Set the fileName
          res.setHeader('content-disposition', `filename=${fileName}`);
          res.setHeader('content-type', 'application/octet-stream');

          debug(`Loaded a file ${fileId} from Google Drive.`);

          response.data
            .on('error', err => {
              debug(err);
              return res.status(400).send('Invalid response.');
            })
            .pipe(res);
        }
        catch (err) {
          debug(err);
          return res.status(400).send('Invalid response.');
        }
      });
    }
  );

  // Send a file to Google Drive.
  router.post('/project/:projectId/form/:formId/storage/gdrive',
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
    router.formio.formio.plans.disableForPlans(['basic', 'independent', 'archived']),
    upload.single('file'),
    function(req, res) {
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          debug(err);
          return res.status(400).send('Project not found.');
        }

        const {settings} = project;

        if (!settings.storage) {
          settings.storage = {};
        }

        if (!settings.storage.googleDrive || !hasValidProviderSettings(settings)) {
          return res.status(400).send('Google Drive Settings not configured. Please go to Data Connections');
        }

        const fileInfo = req.body;

        let uploadType = 'media';

        try {
          if (Buffer.byteLength(req.file.buffer) > 5242880) {
            uploadType = 'resumable';
          }
        }
        // eslint-disable-next-line no-empty
        catch (error) {
          debug(error);
        }

        authenticate(settings)
          .then((drive) => {
            debug(`Uploading a ${fileInfo.name} to Google Drive.`);

            const bufferStream = new Stream.PassThrough();
            bufferStream.end(req.file.buffer);

            const media = {
              mimeType: req.file.mimetype,
              body: bufferStream,
            };

            const fileMetadata = {
              name: fileInfo.name,
              mimeType: req.file.mimetype,
              parents: fileInfo.dir ? [fileInfo.dir] : [],
            };

            // Remove the window from the global to ensure that googleapis works correctly
            const originalWindow = global.window;
            global.window = undefined;

            drive.files.create({
              resource: fileMetadata,
              media,
              fields: 'id',
              uploadType
            }, (err, file) => {
              // Move back the global window
              global.window = originalWindow;

              if (err) {
                debug(err);
                return res.status(400).send('Invalid response.');
              }
              else {
                const {id} = file.data;

                debug(`Uploaded a file ${id} to Google Drive.`);

                // Get the url google drive link
                getUrl({project, file: file.data, drive, id}).then(({url}) => {
                  res.send({id, originalUrl: url});
                });
              }
            });
          })
          .catch(err => {
            debug(err);
            res.status(400).send('Bad request from Google Drive.');
          });
      });
    }
  );

  router.delete('/project/:projectId/form/:formId/storage/gdrive',
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
    router.formio.formio.plans.disableForPlans(['basic', 'independent', 'archived']),
    function(req, res) {
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          debug(err);
          return res.status(400).send('Project not found.');
        }

        const {settings} = project;

        if (!settings.storage) {
          settings.storage = {};
        }

        if (!settings.storage.googleDrive || !hasValidProviderSettings(settings)) {
          return res.status(400).send('Google Drive Settings not configured. Please go to Data Connections');
        }

        const {id, name} = req.query;

        authenticate(settings)
          .then((drive) => {
            debug(`Deleting a ${name} from Google Drive`);

            const originalWindow = global.window;
            global.window = undefined;

            drive.files.delete({
              fileId: id
            }, (err, file) => {
              // Move back the global window
              global.window = originalWindow;

              if (err) {
                debug(err);
                return res.status(400).send('Invalid response.');
              }

              else {
                debug(`Deleted a file ${name} from Google Drive.`);
                res.sendStatus(200);
              }
            });
          })
          .catch(err => {
            debug(err);
            res.status(400).send('Bad request from Google Drive.');
          });
      });
    }
  );
};

module.exports = {
  middleware,
  getUrl,
};
