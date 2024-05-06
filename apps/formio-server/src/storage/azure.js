'use strict';
const storage = require('@azure/storage-blob');
const _ = require('lodash');
const debug = {
  startup: require('debug')('formio:startup')
};

async function getUrl(options = {}) {
  // Allow options.project as an alternative to options.settings
  if (options.project && !options.settings) {
    options.settings = _.get(options.project, 'settings.storage.azure');
  }

  if (!options.settings || !options.settings.connectionString) {
    throw new Error('Storage settings not set.');
  }

  // Get the expiration.
  let expiration = options.settings.expiration ? parseInt(options.settings.expiration, 10) : 900;
  expiration = isNaN(expiration) ? 15 : (expiration / 60);

  // Add start and expiry date.
  const startDate = new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setMinutes(startDate.getMinutes() + expiration);
  startDate.setMinutes(startDate.getMinutes() - 100);

  // Get token
  const perms = options.method === 'POST' ? storage.BlobSASPermissions.parse("c") : storage.BlobSASPermissions.parse("r");
  const service = storage.BlobServiceClient.fromConnectionString(options.settings.connectionString);
  const directory = options.settings.startsWith || '';
  const fileName = _.get(options, 'file.name', options.fileName);
  const blobName = _.trim(`${_.trim(directory, '/')}/${_.trim(fileName, '/')}`, '/');

  // delete blob from storage
  if (options.method === 'DELETE') {
    const containerClient = await service.getContainerClient(_.get(options, 'settings.container'));
    const deleteResponse = await containerClient.deleteBlob(options.fileName);

    if (deleteResponse.errorCode) {
      throw new Error(`Delete File Error ${deleteResponse.errorCode}`);
    }

    return options.fileName;
  }

  const token = storage.generateBlobSASQueryParameters({
    containerName: options.settings.container,
    blobName: blobName,
    permissions: perms,
    startsOn: startDate,
    expiresOn: expiryDate
  }, service.credential).toString();

  // Get URL
  const url = `${service.url}${options.settings.container}/${blobName}?${token}`;

  if (!token || !url) {
    throw new Error('Invalid request.');
  }

  return ({url, key: blobName});
}

async function getEmailFileUrl(project, file) {
  const settings = _.get(project, 'settings.storage.azure');

  if (!settings || !settings.connectionString) {
    throw new Error('Storage settings not set.');
  }

  if (!file?.name) {
    throw new Error('File not provided.');
  }

  // Get the expiration.
  let expiration = settings.expiration ? parseInt(settings.expiration, 10) : 900;
  expiration = isNaN(expiration) ? 15 : (expiration / 60);

  // Add start and expiry date.
  const startDate = new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setMinutes(startDate.getMinutes() + expiration);
  startDate.setMinutes(startDate.getMinutes() - 100);

  // Get token
  const perms = storage.BlobSASPermissions.parse("r");
  const service = storage.BlobServiceClient.fromConnectionString(settings.connectionString);
  const directory = settings.startsWith || '';
  const fileName = file.name || '';
  const blobName = _.trim(`${_.trim(directory, '/')}/${_.trim(fileName, '/')}`, '/');

  const token = storage.generateBlobSASQueryParameters({
    containerName: settings.container,
    blobName: blobName,
    permissions: perms,
    startsOn: startDate,
    expiresOn: expiryDate
  }, service.credential).toString();

  // Get URL
  const url = `${service.url}${settings.container}/${blobName}?${token}`;

  if (!token || !url) {
    throw new Error('Invalid request.');
  }

  return url;
}

const middleware = router => {
  const routes = [
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
      const fileName = req.body.name || req.query.key || req.query.name;

      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        getUrl({project, fileName, method: req.method}).then(
          data => res.json(data),
          err => res.status(400).send(err.message));
      });
    }
  ];

  // Add azure storage endpoints.
  debug.startup('Attaching middleware: Azure Storage GET');
  router.get('/project/:projectId/form/:formId/storage/azure', ...routes);
  debug.startup('Attaching middleware: Azure Storage POST');
  router.post('/project/:projectId/form/:formId/storage/azure', ...routes);
  debug.startup('Attaching middleware: Azure Storage DELETE');
  router.delete('/project/:projectId/form/:formId/storage/azure', ...routes);
};

module.exports = {
  middleware,
  getEmailFileUrl,
};
