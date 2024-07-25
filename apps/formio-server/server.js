'use strict';

require('dotenv').config();
const express = require('express');
const _ = require('lodash');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
const packageJson = require('./package.json');
const cacheControl = require('express-cache-controller');
const {v4: uuidv4} = require('uuid');
const fs = require('fs');
const xss = require("xss");
const license = require('./src/util/license');
const audit = require('./src/util/audit');
const cors = require('cors');
const debug = {
  startup: require('debug')('formio:startup'),
  licenseCheck: require('debug')('formio:licenseCheck'),
};
const RequestCache = require('./src/util/requestCache');
const util = require('./src/util/util');

module.exports = async function(options) {
  try {
    options = options || {};

    // Create cache for requests//
    const requestCache = new RequestCache();

    // Use the express application.
    var app = options.app || express();

    // Functions to mitigate license server crashes:
    // Mitigation function to call if license server is unhealthy
    app.utilizationCheckFailed = () => {
      debug.licenseCheck('Utilization check failed');
      if (!app._recoveryTimeout) {
        console.log('Utilization check failed, going to recovery wait');
        const timeToRecover = 72 * 60 * 60 * 1000; // 72 hours
        app._recoveryTimeout = setTimeout(() => {
          console.log('License server failed to recover, going to restricted mode');
          app.restrictMethods = true;
        }, timeToRecover);
      }
    };
    // Recovery function to call if license check was successful
    app.utilizationCheckSucceed = () => {
      debug.licenseCheck('Utilization check succeed');
      if (app._recoveryTimeout) {
        clearTimeout(app._recoveryTimeout);
        app._recoveryTimeout = null;
        app.restrictMethods = false;
        console.log('License server recovered successfully, going to work normally');
      }
    };

    // Insert middleware for enforcing gradual degradation
    // as a result of multiple license check failures
    app.use(license.generateMiddleware(app));

    // Use the given config.
    var config = options.config || require('./config');

    // Ensure that we create projects within the helper.
    app.hasProjects = true;

    // Create the app server.
    debug.startup('Creating application server');

    if (config.sslEnabled) {
      if (config.sslKey && config.sslCert) {
        app.server = require('https').createServer({
          key: config.sslKey,
          cert: config.sslCert
        }, app);
      }
      else {
        throw new Error("SSL is enabled, but its configuration is not complete. Check your SSL_KEY and SSL_CERT environment variables.");
      }
    }
    else {
      app.server = require('http').createServer(app);
    }

    app.listen = function() {
      return app.server.listen.apply(app.server, arguments);
    };

    app.portalEnabled = (process.env.PRIMARY && process.env.PRIMARY !==  'false') || (process.env.PORTAL_ENABLED && process.env.PORTAL_ENABLED !==  'false');

    // Initialization middleware.
    app.use((req, res, next) => {
      // Do not allow populate.
      if (req.query.populate) {
        delete req.query.populate;
      }
      const sendStatus = res.sendStatus;
      res.sendStatus = function(...args) {
        if (!res.headersSent) {
          return sendStatus.call(this, ...args);
        }
      };
      return next();
    });

    // Use helmet to add CSP to application code.
    app.use(...require('./src/middleware/helmet')(app));

  if (app.portalEnabled) {
    debug.startup('Mounting Portal Application');
    // Override config.js so we can set onPremise to true.
    app.get('/config.js', (req, res) => {
      fs.readFile(`./portal/config.js`, 'utf8', (err, contents) => {
        res.set('Content-Type', 'application/javascript; charset=UTF-8');
        res.send(
          contents.replace(
            /var sac = false;|var ssoLogout = '';|var sso = '';|var onPremise = false;|var ssoTeamsEnabled = false;|var oAuthM2MEnabled = false|var licenseId = '';|var reportingUI = false;|var esign = false;|var whitelabel = false;|var pdfBuilder = false;|var enterpriseBuilder = false;/gi,
            (matched) => {
              if (config.portalSSO && matched.includes('var sso =')) {
                return `var sso = '${config.portalSSO}';`;
              }
              else if (config.ssoTeams && matched.includes('var ssoTeamsEnabled =')) {
                return `var ssoTeamsEnabled = ${config.ssoTeams};`;
              }
              else if (config.portalSSOLogout && matched.includes('var ssoLogout =')) {
                return `var ssoLogout = '${config.portalSSOLogout}';`;
              }
              else if (!config.formio.hosted && matched.includes('var onPremise')) {
                return 'var onPremise = true;';
              }
              else if (app.license && app.license.terms && app.license.terms.options && app.license.terms.options.sac && matched.includes('var sac')) {
                return 'var sac = true;';
              }
              else if (config.whitelabel && app.license.terms.options.whitelabel &&  matched.includes('var whitelabel')) {
                return `var whitelabel = true;`;
              }
              else if (config.enableOauthM2M && matched.includes('var oAuthM2MEnabled')) {
                return 'var oAuthM2MEnabled = true;';
              }
              else if (app.license && app.license.terms && app.license.terms.options && app.license.terms.options.reporting && matched.includes('var reportingUI')) {
                return 'var reportingUI = true;';
              }
              else if (app.license && app.license.terms && app.license.terms.options && app.license.terms.options.esign && matched.includes('var esign')) {
                return 'var esign = true;';
              }
              else if (!config.formio.hosted && app.license && app.license.licenseId && matched.includes('var licenseId')) {
                return `var licenseId = '${app.license.licenseId}'`;
              }
              else if (app.license && app.license.terms && app.license.terms.options && app.license.terms.options.pdfBasic === false && matched.includes('var pdfBuilder')) {
                return 'var pdfBuilder = true;';
              }
              else if (app.license && app.license.terms && app.license.terms.options && app.license.terms.options.enterpriseBuilder && matched.includes('var enterpriseBuilder')) {
                return 'var enterpriseBuilder = true;';
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

    // Hook each request and add usage tracking.
    app.use((req, res, next) => {
      // eslint-disable-next-line callback-return
      next();
      if (app.formio.usageTracking) {
        app.formio.usageTracking.hook(req, res, next);
      }
    });

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
    // Mitigation functions must be available in every middleware
    // that uses license utilization function
    app.formio.utilizationCheckFailed = app.utilizationCheckFailed;
    app.formio.utilizationCheckSucceed = app.utilizationCheckSucceed;
    app.formio.formio.utilizationCheckFailed = app.utilizationCheckFailed;
    app.formio.formio.utilizationCheckSucceed = app.utilizationCheckSucceed;

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
    console.log(`Server version: ${packageJson.version}`);
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

    // made reportingui configuration form available for import
    app.get('/reportingui/config', [
      cors(),
      (req, res) => {
        const reportingUIForm = require('@formio/reporting/reportConfigTemplate.json').resources.reportingui;
        res.json(reportingUIForm);
      }
    ]);

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

    // Load projects and roles.
    debug.startup('Attaching middleware: Project & Roles Loader');
    app.use(require('./src/middleware/loadProjectContexts')(app.formio.formio));

    // Set the project query middleware for filtering disabled projects
    app.use(require('./src/middleware/projectQueryLimits'));

    // Check project status
    app.use(require('./src/middleware/projectUtilization')(app));

    debug.startup('Attaching middleware: CSP');
    if (app.portalEnabled) {
    app.use(require('./src/middleware/cspSettings')(app));
    }
    // Handle our API Keys.
    debug.startup('Attaching middleware: API Key Handler');
    app.use(require('./src/middleware/apiKey')(app.formio.formio));

  // app.get('/project/:projectId/form/:formId/submission/:submissionId/esign', (req, res, next) => {
  //   const {submissionId, projectId} = req.params;
  //   app.formio.formio.resources.submission.model.findById(submissionId).exec().then((submission) => {
  //     if (submission.data.esign && submission.data.esign.id) {
  //       app.formio.formio.resources.project.model.findById(projectId).exec().then((project) => {
  //         const config = _.get(project.settings, 'esign');
  //         // TODO_esign: logic that gets downloadURL from eSign provider using provider config and sends a downloadURL as response
  //       });
  //     }
  //   });
  // });

    var hooks = _.merge(require('./src/hooks/settings')(app), options.hooks);

    // Start the api server.
    debug.startup('Initializing Form.io Core');
    const formio = await app.formio.init(hooks);
    debug.startup('Done initializing Form.io Core');
    // Kick off license validation process
    debug.startup('Checking License');
    const licenseValidationPromise = license.validate(app);
    licenseValidationPromise.then(() => {
      if (config.formio.hosted) {
        // Load the usage hooks.
        debug.startup('Attaching middleware: Usage Tracking');
        app.formio.usageTracking = require('./src/usage')(app.formio);
      }
      else {
        require('./src/util/configureDefaultProjectTemplate')(app);
      }
    });

    debug.startup('Attaching middleware: License Terms');
    app.use(require('./src/middleware/attachLicenseTerms')(licenseValidationPromise, app));

    app.get('/project/:projectId/form/:formId/submission/:submissionId/changelog',
    (req, res, next) => {
      if (config.formio.hosted || !_.get(req, 'licenseTerms.options.sac', false)) {
        res.sendStatus(403);
        return;
      }
      return next();
    },
    require('./src/middleware/apiKey')(app.formio.formio),
    require('./src/middleware/remoteToken')(app),
    app.formio.formio.middleware.alias,
    require('./src/middleware/aliasToken')(app),
    app.formio.formio.middleware.tokenHandler,
    app.formio.formio.middleware.params,
    app.formio.formio.middleware.permissionHandler,
    async (req, res, next) => {
      try {
        const currentForm = await app.formio.formio.cache.loadCurrentForm(req);
        await util.getSubmissionRevisionModel(app.formio.formio, req, currentForm, false);
        return next();
      }
      catch (err) {
        return next(err);
      }
    },
    require('./src/middleware/submissionChangeLog')(app),
    (req, res) => {
      res.send(req.changelog);
    });

    debug.startup('Attaching middleware: Cache');
    app.formio.formio.cache = _.assign(app.formio.formio.cache, require('./src/cache/cache')(app.formio));

      // Attach PDF proxy router and backward compatibility endpoints for it
    debug.startup('Attaching middleware: PDF proxy');
    require('./src/middleware/pdfProxy')(app);

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

    // Check if the request is allowed for the current project
    debug.startup('Attaching middleware: Check Request Allowed');
    app.use(app.formio.formio.middleware.checkRequestAllowed);

    app.post('/project/:projectId/import', app.formio.formio.middleware.licenseUtilization);

    // Mount formio at /project/:projectId.
    debug.startup('Mounting Core API');
    app.use('/project/:projectId', app.formio);

    // Allow for the project public info to be sent without access to the project endpoint.
    debug.startup('Attaching middleware: config.json');
    app.get('/project/:projectId/config.json', (req, res) => {
      if (!_.get(req.currentProject, 'settings.allowConfig', false)) {
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
        window.ON_PREMISE= ${!config.formio.hosted};
        window.LICENSE_ENABLED = ${project.formManagerEnabled};
        window.VPAT_ENABLED = ${_.get(app, 'license.terms.options.vpat') && (config.vpat || _.get(project, 'config.vpat', '').toLowerCase()==='true')};
        window.SAC_ENABLED = ${_.get(app, 'license.terms.options.sac') && (config.sac || _.get(project, 'config.sac', '').toLowerCase()==='true')};
        window.PROJECT = ${JSON.stringify({
          _id: project._id,
          title: project.title,
          name: project.name,
          config: project.config,
          public: project.public
        })};
        window.APP_BRANDING = true;
        window.LICENSE_SERVER = '${config.licenseServer}';
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
        let customJs;
        if (_.get(req.currentProject, 'public.custom.js', '')) {
          customJs = `<script type="text/javascript" src="${xss(req.currentProject.public.custom.js)}" defer></script>`;
        }
        fs.readFile(`./portal/manager/view/index.html`, 'utf8', (err, contents) => {
          if (err) {
            return next(err);
          }
          if (customJs) {
            contents = contents.replace('</body>', `${customJs}</body>`);
          }
          res.send(contents.replace('<head>', `<head>${script}`));
        });
      }
    );
    app.use('/project/:projectId/manage', express.static(`./portal/manager`));

    // Mount the saml integration.
    debug.startup('Attaching middleware: SAML');
    app.use('/project/:projectId/saml', require('./src/saml/saml')(app.formio.formio, app.formio.config));

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

    // Add Server part Captcha verification.
    debug.startup('Attaching middleware: Captcha verification');
    app.use('/project/:projectId/captcha', require('./src/middleware/captcha')(app.formio.formio));

    // Mount the error logging middleware.
    debug.startup('Attaching middleware: Error Handler');
    app.use((err, req, res, next) => {
      // delegate to the default Express error handler when the headers have already been sent to the client
      if (res.headersSent) {
        return next(err);
      }
      console.log('Uncaught exception:');
      if (err) {
        console.log(err);
        console.log(err.stack);
      }
      res.status(err.status ? err.status : 400).send(typeof err === 'string' ? {message: err} : err);
    });

    debug.startup('Attaching middleware: File Storage');
    app.storage = require('./src/storage/').mountStorages(app);

    // Check to install primary project.
    debug.startup('Installing');
    debug.startup('Installing');
    await require('./src/util/install')(app, config);
    debug.startup('Done Installing');
    return {
      app: app,
      config: config
    };
  }
  catch (err) {
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
  }
};
