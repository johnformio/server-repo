'use strict';
const storage = require('azure-storage');
const _ = require('lodash');
module.exports = (router) => {
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
      router.formio.formio.cache.loadProject(req, req.projectId, function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        const settings = _.get(project, 'settings.storage.azure');
        if (!settings || !settings.connectionString) {
          return res.status(400).send('Storage settings not set.');
        }

        const directory = settings.startsWith || '';
        const fileName = req.body.name || req.query.name;

        // Get the expiration.
        let expiration = settings.expiration ? parseInt(settings.expiration, 10) : 900;
        expiration = isNaN(expiration) ? 15 : (expiration / 60);

        // Add start and expiry date.
        const startDate = new Date();
        const expiryDate = new Date(startDate);
        expiryDate.setMinutes(startDate.getMinutes() + expiration);
        startDate.setMinutes(startDate.getMinutes() - 100);

        try {
          const perms = storage.BlobUtilities.SharedAccessPermissions;
          const service = storage.createBlobService(settings.connectionString);
          const token = service.generateSharedAccessSignature(
            settings.container,
            _.trim(`${_.trim(directory, '/')}/${_.trim(fileName, '/')}`, '/'),
            {
              AccessPolicy: {
                Permissions: (req.method === 'POST') ? perms.CREATE : perms.READ,
                Start: startDate,
                Expiry: expiryDate
              }
            }
          );
          const url = service.getUrl(
            settings.container,
            _.trim(`${_.trim(directory, '/')}/${_.trim(fileName, '/')}`, '/'),
            token,
            true
          );

          if (!token || !url) {
            return res.status(400).send('Invalid request.');
          }

          // Send the response.
          res.json({url});
        }
        catch (err) {
          return res.status(400).send(err.message);
        }
      });
    }
  ];

  // Add azure storage endpoints.
  router.get('/project/:projectId/form/:formId/storage/azure', ...routes);
  router.post('/project/:projectId/form/:formId/storage/azure', ...routes);
};
