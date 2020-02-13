'use strict';
const storage = require('azure-storage');
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
  const perms = storage.BlobUtilities.SharedAccessPermissions;
  const service = storage.createBlobService(options.settings.connectionString);
  const directory = options.settings.startsWith || '';
  const fileName = _.get(options, 'file.name', options.fileName);

  const token = service.generateSharedAccessSignature(
    options.settings.container,
    _.trim(`${_.trim(directory, '/')}/${_.trim(fileName, '/')}`, '/'),
    {
      AccessPolicy: {
        Permissions: (options.method === 'POST') ? perms.CREATE : perms.READ,
        Start: startDate,
        Expiry: expiryDate
      }
    }
  );

  // Get URL
  const url = service.getUrl(
    options.settings.container,
    _.trim(`${_.trim(directory, '/')}/${_.trim(fileName, '/')}`, '/'),
    token,
    true
  );

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
    router.formio.formio.plans.disableForPlans(['basic', 'independent']),
    function(req, res) {
      const fileName = req.body.name || req.query.name;

      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        getUrl({project, fileName, method: req.method}).then(
          url => res.send({url}),
          err => res.status(400).send(err.message));
      });
    }
  ];

  // Add azure storage endpoints.
  debug.startup('Attaching middleware: Azure Storage GET');
  router.get('/project/:projectId/form/:formId/storage/azure', ...routes);
  debug.startup('Attaching middleware: Azure Storage POST');
  router.post('/project/:projectId/form/:formId/storage/azure', ...routes);
};

module.exports = {
  middleware,
  getUrl
};
