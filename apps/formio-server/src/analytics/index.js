'use strict';

module.exports = (formioServer) => {
  const restrictToFormioEmployees = require('../middleware/restrictToFormioEmployees')(formioServer.formio);
  const router = require('express').Router();
  const analyticsRoutes = formioServer.analytics.routes(formioServer.formio);

  // Mount the project routes.
  router.use('/project/:projectId/analytics',
    formioServer.formio.middleware.tokenHandler,
    formioServer.formio.middleware.permissionHandler,
    analyticsRoutes.project
  );

  // Mount the admin routes.
  router.use('/analytics',
    formioServer.formio.middleware.tokenHandler,
    restrictToFormioEmployees,
    analyticsRoutes.admin
  );

  return router;
};
