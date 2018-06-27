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

  // Provide a way to upgrade projects.
  router.put('/upgrade',
    formioServer.formio.middleware.tokenHandler,
    restrictToFormioEmployees,
    (req, res, next) => {
      const plans = ['basic', 'independent', 'team', 'commercial', 'trial'];
      if (!req.body || !req.body.project || !req.body.plan) {
        return res.status(400).send('Expected params `project` and `plan`.');
      }
      if (plans.indexOf(req.body.plan) === -1) {
        return res.status(400).send(`Expexted \`plan\` of type: ${plans.join(',')}.`);
      }

      formioServer.formio.resources.project.model.update({
        _id: formioServer.formio.util.idToBson(req.body.project),
        deleted: {$eq: null}
      }, {$set: {plan: req.body.plan}}, (err, results) => {
        if (err) {
          return res.status(400).send(err);
        }

        return res.sendStatus(200);
      });
    }
  );

  return router;
};
