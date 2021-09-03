'use strict';

require('dotenv').config();
const express = require('express');
const _helmet = require('helmet');
const _ = require('lodash');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
const packageJson = require('./package.json');
const Q = require('q');
const cacheControl = require('express-cache-controller');
const {v4: uuidv4} = require('uuid');
const fs = require('fs');
const multipart = require('connect-multiparty');
const os = require('os');
const license = require('./src/util/license');
const audit = require('./src/util/audit');
const cors = require('cors');
const debug = {
  startup: require('debug')('formio:startup')
};
const RequestCache = require('./src/util/requestCache');
const CryptoJS = require('crypto-js');

const helmet = _helmet({
  hsts: {
    preload: true,
  },
  contentSecurityPolicy: false,
});

module.exports = function(options) {
  options = options || {};
  var q = Q.defer();

  // Create cache for requests
  const requestCache = new RequestCache();

  // Use the express application.
  var app = options.app || express();

  // Insert middleware for enforcing gradual degradation
  // as a result of multiple license check failures
  app.use(license.generateMiddleware(app));

  // Use the given config.
  var config = options.config || require('./config');

  // Ensure that we create projects within the helper.
  app.hasProjects = true;

  // Create the app server.
  debug.startup('Creating application server');

  if (config.sslKey && config.sslCert) {
    app.server = require('https').createServer({
      key: config.sslKey,
      cert: config.sslCert
    }, app);
  }
  else {
    app.server = require('http').createServer(app);
  }

  app.listen = function() {
    return app.server.listen.apply(app.server, arguments);
  };

  const portalEnabled = (process.env.PRIMARY && process.env.PRIMARY !==  'false') || (process.env.PORTAL_ENABLED && process.env.PORTAL_ENABLED !==  'false');
  // Secure html pages with the proper headers.
  debug.startup('Attaching middleware: Helmet');
  app.use((req, res, next) => {
    if (
      (req.url === '/' && portalEnabled) ||
      req.url.endsWith('.html') ||
      req.url.endsWith('/manage') ||
      req.url.endsWith('/manage/view')
    ) {
      return helmet(req, res, next);
    }
    return next();
  });

  if (portalEnabled) {
    debug.startup('Mounting Portal Application');
    // Override config.js so we can set onPremise to true.
    app.get('/template/config.js', (req, res) => {
      fs.readFile(`./portal/config.js`, 'utf8', (err, contents) => {
        res.send(
          contents.replace(
            /var hostedPDFServer = '';|var sac = false;|var ssoLogout = '';|var sso = '';|var onPremise = false;|var ssoTeamsEnabled = false;|var oAuthM2MEnabled = false/gi,
            (matched) => {
              if (config.hostedPDFServer && matched.includes('var hostedPDFServer')) {
                return `var hostedPDFServer = '${config.hostedPDFServer}';`;
              }
              else if (config.portalSSO && matched.includes('var sso =')) {
                return `var sso = '${config.portalSSO}';`;
              }
              else if (config.ssoTeams && matched.includes('var ssoTeamsEnabled =')) {
                return `var ssoTeamsEnabled = ${config.ssoTeams};`;
              }
              else if (config.portalSSOLogout && matched.includes('var ssoLogout =')) {
                return `var ssoLogout = '${config.portalSSOLogout}';`;
              }
              else if (!process.env.FORMIO_HOSTED && matched.includes('var onPremise')) {
                return 'var onPremise = true;';
              }
              else if (config.sac && app.license.terms.options.sac && matched.includes('var sac')) {
                return 'var sac = true;';
              }
              else if (config.enableOauthM2M && matched.includes('var oAuthM2MEnabled')) {
                return 'var oAuthM2MEnabled = true;';
              }
              return matched;
            }
          )
          .replace(/https:\/\/license.form.io/gi, (matched) => {
            if (config.licenseServer && config.licenseServer !== matched) {
              return config.licenseServer;
            }
            return matched;
          })
        );
      });
    });
    app.use(express.static(`./portal`));
  }

  app.use(express.static(`./public`));

  // Make sure no-cache headers are sent to prevent IE from caching Ajax requests.
  debug.startup('Attaching middleware: Cache Control');
  app.use(cacheControl({
    noCache: true
  }));

  debug.startup('Attaching middleware: Favicon');
  app.use(favicon('./favicon.ico'));

  // Add Middleware necessary for REST API's
  debug.startup('Attaching middleware: Body Parser and MethodOverride');
  app.use(bodyParser.urlencoded({extended: true, limit: config.maxBodySize}));
  app.use(bodyParser.json({limit: config.maxBodySize}));

  // Error handler for malformed JSON
  debug.startup('Attaching middleware: Malformed JSON Handler');
  app.use(function(err, req, res, next) {
    if (err instanceof SyntaxError) {
      return res.status(400).send(err.message);
    }

    next();
  });

  app.use(require('./src/middleware/requestCache')(requestCache));

  // Create the formio server.
  debug.startup('Creating Form.io Core Server');
  app.formio = options.server || require('formio')(config.formio);

  debug.startup('Attaching middleware: Restrict Request Types');
  app.use(app.formio.formio.middleware.restrictRequestTypes);

  // Attach the formio-server config.
  app.formio.config = _.omit(config, 'formio');

  // Import the OAuth providers
  debug.startup('Attaching middleware: OAuth Providers');
  app.formio.formio.oauth = require('./src/oauth/oauth')(app.formio.formio);

  app.formio.formio.twoFa = require('./src/authentication/2FA')(app.formio);
  // Establish our url alias middleware.
  debug.startup('Attaching middleware: Alias Handler');
  app.use(require('./src/middleware/alias')(app.formio.formio));

  debug.startup('Attaching middleware: UUID Request');
  app.use((req, res, next) => {
    // Allow audit uuid from external header.
    req.uuid = req.header('X-Request-UUID');
    if (!req.uuid) {
      req.uuid = uuidv4();
    }
    req.startTime = new Date();

    app.formio.formio.audit('REQUEST_START', req, req.method, req.path, JSON.stringify(req.query));
    app.formio.formio.log('Request', req, req.method, req.path, JSON.stringify(req.query));

    // Override send function to log event
    const resend = res.send;
    res.send = function() {
      const duration = new Date() - req.startTime;
      if (duration > 200) {
        app.formio.formio.log('Long Request', req, `${duration}ms`);
      }
      app.formio.formio.log('Duration', req, `${duration}ms`);
      app.formio.formio.log('Response Code', req, res.statusCode);
      if (res.statusCode < 300) {
        audit(req, res, arguments[0], app.formio.formio.audit);
      }
      app.formio.formio.audit('REQUEST_END', req, res.statusCode, `${duration}ms`);
      resend.apply(this, arguments);
    };

    next();
  });

  // Status response.
  debug.startup('Attaching middleware: Status');
  app.get('/status', [
    cors(),
    (req, res) => {
      res.json({
        version: packageJson.version,
        schema: packageJson.schema,
        environmentId: app.environmentId
      });
    }
  ]);

  // Load projects and roles.
  debug.startup('Attaching middleware: Project & Roles Loader');
  app.use(require('./src/middleware/loadProjectContexts')(app.formio.formio));

  // Set the project query middleware for filtering disabled projects
  app.use(require('./src/middleware/projectQueryLimits'));

  // Strict-Transport-Security middleware
  const hsts = _helmet.hsts({
    preload: true,
  });

  // Referer-Policy middleware
  const referrerPolicy = _helmet.referrerPolicy({
    policy: ['origin', 'same-origin'],
  });

  const cspSettings = require('./src/middleware/cspSettings')(app);

  if (portalEnabled) {
    debug.startup('Attaching middleware: Helmet\'s middlewares');
    app.use(cspSettings, hsts, referrerPolicy);
  }

   // Check project status
  app.use(require('./src/middleware/projectUtilization')(app.formio.formio));

   // CORS Support
  debug.startup('Attaching middleware: CORS');
  var corsMiddleware = require('./src/middleware/corsOptions')(app);
  var corsRoute = cors(corsMiddleware);
  app.use(function(req, res, next) {
    // If headers already sent, skip cors.
    if (res.headersSent) {
      return next();
    }
    corsRoute(req, res, next);
  });

  // Handle our API Keys.
  debug.startup('Attaching middleware: API Key Handler');
  app.use(require('./src/middleware/apiKey')(app.formio.formio));

  // Download a submission pdf.
  debug.startup('Attaching middleware: PDF Download');

  const downloadPDF = [
    require('./src/middleware/apiKey')(app.formio.formio),
    require('./src/middleware/remoteToken')(app),
    app.formio.formio.middleware.alias,
    require('./src/middleware/aliasToken')(app),
    app.formio.formio.middleware.tokenHandler,
    app.formio.formio.middleware.params,
    app.formio.formio.middleware.permissionHandler,
    require('./src/middleware/download')(app.formio)
  ];

  app.get('/project/:projectId/:formAlias/submission/:submissionId/download', downloadPDF);
  app.get('/project/:projectId/form/:formId/submission/:submissionId/download', downloadPDF);
  app.get('/project/:projectId/:formAlias/submission/:submissionId/download/:fileId', downloadPDF);
  app.get('/project/:projectId/form/:formId/submission/:submissionId/download/:fileId', downloadPDF);

  app.post('/project/:projectId/form/:formId/download', downloadPDF);

  app.post('/project/:projectId/form/:formId/submission/:submissionId/signrequest',
    (req, res, next) => {
      const {signrequest} = req.currentProject.settings;
      const {event_time: eventTime, event_type: eventType, event_hash: eventHash} = req.body;

      if (!signrequest || !signrequest.apiKey || !eventTime || !eventType || !eventHash) {
        return res.sendStatus(400);
      }

      /* eslint-disable new-cap */
      const calculatedHash = CryptoJS.HmacSHA256(`${eventTime}${eventType}`, signrequest.apiKey).toString();

      if (eventHash !== calculatedHash) {
        return res.sendStatus(403);
      }

      next();
    },
    async (req, res, next) => {
      const {submissionId} = req.params;
      const event = req.body['event_type'];
      let updates = null;
      let status = 200;

      switch (event) {
        case 'converted': {
          const {document} = req.body;

          updates = {
            $set: {
              'data.signrequest.document': {
                uuid: document.uuid,
                name: document.name,
                status: document.status
              }
            }
          };
        }
        break;
        case 'signer_signed': {
          const {document, signer} = req.body;

          updates = {
            $set: {
              'data.signrequest.document.status': document.status
            },
            $addToSet: {
              'data.signrequest.signers': {
                email: signer.email,
                name: `${signer['first_name']} ${signer['last_name']}`,
                signingDate: signer['signed_on']
              }
            }
          };
        }
        break;
        case 'signed': {
          const {document} = req.body;

          updates = {
            $set: {
              'data.signrequest.document.status': document.status
            }
          };
        }
      }

      if (updates) {
        await new Promise((resolve) => {
          const cb = (err, res) => {
            if (err) {
              status = 500;
            }
            resolve();
          };

          app.formio.formio.resources.submission.model.findByIdAndUpdate(
            submissionId,
            updates
          , cb);
        });
      }

      res.sendStatus(status);
    }
  );

  debug.startup('Attaching middleware: PDF Upload');
  const uploadPDF = [
    require('./src/middleware/remoteToken')(app),
    require('./src/middleware/aliasToken')(app),
    app.formio.formio.middleware.tokenHandler,
    app.formio.formio.middleware.params,
    app.formio.formio.middleware.permissionHandler,
    multipart({
      autoFiles: true,
      uploadDir: os.tmpdir(),
    }),
    require('./src/middleware/upload')(app.formio)
  ];
  app.post('/project/:projectId/upload', uploadPDF);

  // Adding google analytics to our api.
  // Does not apply if deployed
  if (config.gaTid && process.env.FORMIO_HOSTED) {
    debug.startup('Attaching middleware: Google Analytics');
    var ua = require('universal-analytics');
    app.use(function(req, res, next) {
      next(); // eslint-disable-line callback-return

      var visitor = ua(config.gaTid);
      visitor.pageview(req.url).send();
    });
  }

  require('./src/util/modules')(app);

  var hooks = _.merge(require('./src/hooks/settings')(app), options.hooks);

  // Start the api server.
  debug.startup('Initializing Form.io Core');
  app.formio.init(hooks).then(function(formio) {
    debug.startup('Done initializing Form.io Core');

    // Kick off license validation process
    debug.startup('Checking License');
    license.validate(app);

    debug.startup('Attaching middleware: Cache');
    app.formio.formio.cache = _.assign(app.formio.formio.cache, require('./src/cache/cache')(app.formio));

    // The formio app sanity endpoint.
    debug.startup('Attaching middleware: Health Check');
    app.get(
      '/health',
      (req, res, next) => {
        if (config.verboseHealth) {
          req.verboseHealth = true;
        }

        next();
      },
      require('./src/middleware/health')(app.formio.formio),
      formio.update.sanityCheck,
      app.formio.formio.middleware.mongodbConnectionState(app.formio.formio),
      require('./src/middleware/requestCount')(requestCache),
      (req, res) => {
      const {requestCount, mongodbConnectionState} = req;
      const response = {
        agregatedStatus: res.statusCode === 200 ? 'UP' : 'DOWN',
        requestCount,
        mongodbConnectionState,
        license: Boolean(app.license),
      };

      res.send(response);
    });

    // Respond with default server information.
    debug.startup('Attaching middleware: Project Index');
    app.get('/', require('./src/middleware/projectIndex')(app.formio.formio));

    // Don't allow accessing a project's forms and other if it is remote. Redirect to the remote instead.
    debug.startup('Attaching middleware: Remote Redirect');
    app.use('/project/:projectId', require('./src/middleware/remoteRedirect')(app.formio));

    app.post('/project/:projectId/import', app.formio.formio.middleware.licenseUtilization);

    // Mount formio at /project/:projectId.
    debug.startup('Mounting Core API');
    app.use('/project/:projectId', app.formio);

    // Allow for the project public info to be sent without access to the project endpoint.
    debug.startup('Attaching middleware: config.json');
    app.get('/project/:projectId/config.json', (req, res) => {
      if (!req.currentProject.settings.allowConfig) {
        return res.json({
          _id: req.currentProject._id
        });
      }
      const config = req.currentProject.config || {};
      return res.json({
        _id: req.currentProject._id,
        name: req.currentProject.name,
        config: config
      });
    });

    /**
     * Get the application variables for the form manager and viewer.
     * @param project
     * @return {string}
     */
    const appVariables = function(project) {
      return `
        window.LICENSE_ENABLED = true;
        window.VPAT_ENABLED = ${_.get(app, 'license.terms.options.vpat') && (config.vpat || _.get(project, 'config.vpat', '').toLowerCase()==='true')};
        window.SAC_ENABLED = ${_.get(app, 'license.terms.options.sac') && (config.sac || _.get(project, 'config.sac', '').toLowerCase()==='true')};
        window.PROJECT = ${JSON.stringify({
          _id: project._id,
          title: project.title,
          name: project.name,
          config: project.config,
          public: project.public
        })};
        window.APP_BRANDING = false;
      `;
    };

    const loadProjectSettings = (req, res, next) => {
      // Create fake user and project so that it will load public settings.
      res.resource = {item: req.currentProject};
      req.user = {teams: []};
      formio.middleware.projectSettings(req, res, next);
    };

    // Add the form manager.
    debug.startup('Mounting Form Manager');
    app.get('/project/:projectId/manage', [
      require('./src/middleware/licenseUtilization').middleware(app),
      loadProjectSettings,
      (req, res, next) => {
        const script = `<script type="text/javascript">
          window.PROJECT_URL = location.origin + location.pathname.replace(/\\/manage\\/?$/, '');
          ${appVariables(req.currentProject)}
        </script>`;
        fs.readFile(`./portal/manager/index.html`, 'utf8', (err, contents) => {
          if (err) {
            return next(err);
          }
          res.send(contents.replace('<head>', `<head>${script}`));
        });
      }
    ]);
    debug.startup('Mounting Form Viewer');
    app.get('/project/:projectId/manage/view',
      loadProjectSettings,
      (req, res, next) => {
        const script = `<script type="text/javascript">
          window.PROJECT_URL = location.origin + location.pathname.replace(/\\/manage\\/view\\/?$/, '');
          ${appVariables(req.currentProject)}
        </script>`;
        fs.readFile(`./portal/manager/view/index.html`, 'utf8', (err, contents) => {
          if (err) {
            return next(err);
          }
          res.send(contents.replace('<head>', `<head>${script}`));
        });
      }
    );
    app.use('/project/:projectId/manage', express.static(`./portal/manager`));

    // Mount the saml integration.
    debug.startup('Attaching middleware: SAML');
    app.use('/project/:projectId/saml', require('./src/saml/saml')(app.formio));

    // Mount the aggregation system.
    debug.startup('Attaching middleware: Report API');
    app.use('/project/:projectId/report', require('./src/middleware/report')(app.formio));

    // Allow changing the owner of a project
    debug.startup('Attaching middleware: Owner Management');
    app.use('/project/:projectId/owner', require('./src/middleware/projectOwner')(app.formio));

    // Add remote token generation endpoint.
    debug.startup('Attaching middleware: Remote Token Management');
    app.use('/project/:projectId/access/remote', require('./src/middleware/remoteAccess')(app.formio));

    // Mount validate submission data endpoint.
    debug.startup('Attaching middleware: Validate Submission Data');
    app.use('/project/:projectId/form/:formId/validate', require('./src/middleware/validateSubmission')(app.formio));

    // Mount the error logging middleware.
    debug.startup('Attaching middleware: Error Handler');
    app.use((err, req, res, next) => {
      /* eslint-disable no-console */
      console.log('Uncaught exception:');
      if (err) {
        console.log(err);
        console.log(err.stack);
      }
      /* eslint-enable no-console */
      res.status(400).send(typeof err === 'string' ? {message: err} : err);
    });

    debug.startup('Attaching middleware: File Storage');
    app.storage = require('./src/storage/index.js')(app);

    // Check to install primary project.
    debug.startup('Installing');
    require('./src/util/install')(app, config, () => {
      debug.startup('Done Installing');
      return q.resolve({
        app: app,
        config: config
      });
    });
  });

  // Do some logging on uncaught exceptions in the application.
  process.on('uncaughtException', function(err) {
    /* eslint-disable no-console */
    console.log('Uncaught exception:');
    if (err) {
      console.log(err);
      console.log(err.stack);
    }
    /* eslint-enable no-console */

    // Give the loggers some time to log before exiting.
    setTimeout(function() {
      process.exit(1);
    }, 2500);
  });

  return q.promise;
};
