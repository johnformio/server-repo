'use strict';

require('dotenv').load({silent: true});
var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var packageJson = require('./package.json');
var Q = require('q');
var cacheControl = require('express-cache-controller');
var uuid = require('uuid/v4');
var fs = require('fs');

module.exports = function(options) {
  options = options || {};
  var q = Q.defer();

  // Use the express application.
  var app = options.app || express();

  // Use the given config.
  var config = options.config || require('./config');

  // Add jslogger if configured.
  var jslogger = null;
  if (config.jslogger) {
    jslogger = require('jslogger')({key: config.jslogger});
  }

  // Connect to redis.
  const RedisInterface = require('formio-services/services/RedisInterface');
  const redis = new RedisInterface(config.redis);

  // Load the analytics hooks.
  const analytics = require('./src/analytics/analytics')(redis);

  var Logger = require('./src/logger/index')(config);

  // Ensure that we create projects within the helper.
  app.hasProjects = true;

  // Create the app server.
  app.server = require('http').createServer(app);
  app.listen = function() {
    return app.server.listen.apply(app.server, arguments);
  };

  if (config.licenseData && config.licenseData.portal && process.env.PRIMARY) {
    // Override config.js so we can set onPremise to true.
    app.get('/config.js', (req, res) => {
      fs.readFile(`./portal/config.js`, 'utf8', (err, contents) => {
        res.send(contents.replace(/var hostedPDFServer = '';|var sso = '';|var onPremise = false;/gi, (matched) => {
          if (config.hostedPDFServer && matched.indexOf('var hostedPDFServer') !== -1) {
            return `var hostedPDFServer = '${config.hostedPDFServer}';`;
          }
          else if (config.portalSSO && matched.indexOf('var sso') !== -1) {
            return `var sso = '${config.portalSSO}';`;
          }
          else if (config.portalSSOLogout && matched.indexOf('var ssoLogout') !== -1) {
            return `var ssoLogout = '${config.portalSSOLogout}';`;
          }
          else if (matched.indexOf('var onPremise') !== -1) {
            return 'var onPremise = true;';
          }
          return matched;
        }));
      });
    });
    app.use(express.static(`./portal`));
  }

  // Make sure no-cache headers are sent to prevent IE from caching Ajax requests.
  app.use(cacheControl({
    noCache: true
  }));

  // Hook each request and add analytics support.
  app.use(analytics.hook.bind(analytics));

  app.use(favicon('./favicon.ico'));

  // Add Middleware necessary for REST API's
  app.use(bodyParser.urlencoded({extended: true, limit: config.maxBodySize}));
  app.use(bodyParser.json({limit: config.maxBodySize}));
  app.use(methodOverride('X-HTTP-Method-Override'));

  // Error handler for malformed JSON
  app.use(function(err, req, res, next) {
    if (err instanceof SyntaxError) {
      return res.status(400).send(err.message);
    }

    next();
  });

  // Create the formio server.
  app.formio = options.server || require('formio')(config.formio);
  app.use(app.formio.formio.middleware.restrictRequestTypes);

  // Attach the formio-server config.
  app.formio.config = _.omit(config, 'formio');

  // Add the redis interface.
  app.formio.redis = redis;

  // Attach the analytics to the formio server and attempt to connect.
  app.formio.analytics = analytics;

  // Import the OAuth providers
  app.formio.formio.oauth = require('./src/oauth/oauth')(app.formio.formio);

  // Establish our url alias middleware.
  app.use(require('./src/middleware/alias')(app.formio.formio));

  // CORS Support
  var corsMiddleware = require('./src/middleware/corsOptions')(app);
  var corsRoute = require('cors')(corsMiddleware);
  app.use(function(req, res, next) {
    // If headers already sent, skip cors.
    if (res.headersSent) {
      return next();
    }
    corsRoute(req, res, next);
  });

  app.use((req, res, next) => {
    req.uuid = uuid();
    req.startTime = new Date();

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
      resend.apply(this, arguments);
    };

    next();
  });

  // Status response.
  app.get('/status', (req, res) => {
    res.json({
      version: packageJson.version,
      schema: packageJson.schema
    });
  });

  // Load current project and roles.
  app.use((req, res, next) => {
    // If there is no projectId, don't error out, just skip loading the current project.
    let projectId = req.projectId;
    if (req.params.projectId) {
      projectId = req.params.projectId;
    }
    if (!projectId) {
      return next();
    }

    app.formio.formio.cache.loadCurrentProject(req, function(err, currentProject) {
      if (err || !currentProject) {
        return next();
      }
      req.currentProject = currentProject.toObject();

      app.formio.formio.resources.role.model.find(app.formio.formio.hook.alter('roleQuery', {deleted: {$eq: null}}, req))
        .sort({title: 1})
        .lean()
        .exec((err, roles) => {
          if (err || !roles) {
            return next();
          }
          req.currentProject.roles = roles;
          return next();
        });
    });
  });

  // Handle our API Keys.
  app.use(require('./src/middleware/apiKey')(app.formio.formio));

  // Download a submission pdf.
  const downloadPDF = [
    require('./src/middleware/aliasToken')(app),
    app.formio.formio.middleware.tokenHandler,
    app.formio.formio.middleware.params,
    app.formio.formio.middleware.permissionHandler,
    require('./src/middleware/download')(app.formio.formio)
  ];

  app.get('/project/:projectId/form/:formId/submission/:submissionId/download', downloadPDF);
  app.get('/project/:projectId/form/:formId/submission/:submissionId/download/:fileId', downloadPDF);

  // Adding google analytics to our api.
  if (config.gaTid) {
    var ua = require('universal-analytics');
    app.use(function(req, res, next) {
      next(); // eslint-disable-line callback-return

      var visitor = ua(config.gaTid);
      visitor.pageview(req.url).send();
    });
  }

  var hooks = _.merge(require('./src/hooks/settings')(app), options.hooks);

  // Start the api server.
  app.formio.init(hooks).then(function(formio) {
    // Check the license for validity.
    require('./src/util/license')(app, config);

    app.use((req, res, next) => {
      const form = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}$/;
      const submission = /\/project\/[a-f0-9]{24}\/form\/[a-f0-9]{24}\/submission(\/[a-f0-9]{24})?$/;
      let type;
      if (submission.test(req.path)) {
        type = 'Submission';
      }
      else if (form.test(req.path)) {
        type = 'Form';
      }
      else {
        type = 'Other';
      }
      app.formio.formio.log('RequestType', req, req.method, type);

      next();
    });

    app.formio.formio.cache = _.assign(app.formio.formio.cache, require('./src/cache/cache')(formio));

    // The formio app sanity endpoint.
    app.get('/health', require('./src/middleware/health')(app.formio.formio), formio.update.sanityCheck);

    // Respond with default server information.
    app.get('/', require('./src/middleware/projectIndex')(app.formio.formio));

    // Don't allow accessing a project's forms and other if it is remote. Redirect to the remote instead.
    app.use('/project/:projectId', require('./src/middleware/remoteRedirect')(app.formio));

    // Mount formio at /project/:projectId.
    app.use('/project/:projectId', app.formio);

    // Allow for the project public info to be sent without access to the project endpoint.
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
        window.APP_SSO = '${_.get(project, 'config.sso', '')}';
        window.SSO_PROJECT = '${_.get(project, 'config.ssoProject', '')}';
        window.APP_TITLE = '${_.get(project, 'config.title', '')}';
        window.APP_JS = '${_.get(project, 'config.js', '')}';
        window.APP_CSS = '${_.get(project, 'config.css', '')}';
        window.APP_LOGO = '${_.get(project, 'config.logo', '')}';
        window.APP_LOGOHEIGHT = '${_.get(project, 'config.logoHeight', '')}';
        window.APP_NAVBAR = '${_.get(project, 'config.navbar', '')}';
        window.APP_BRANDING = false;
      `;
    };

    // Add the form manager.
    if (config.licenseData && config.licenseData.portal) {
      app.get('/project/:projectId/manage', (req, res) => {
        const script = `<script type="text/javascript">
          window.PROJECT_URL = location.origin + location.pathname.replace(/\\/manage\\/?$/, '');
          ${appVariables(req.currentProject)}
        </script>`;
        fs.readFile(`./portal/manager/index.html`, 'utf8', (err, contents) => {
          res.send(contents.replace('<head>', `<head>${script}`));
        });
      });
      app.get('/project/:projectId/manage/view', (req, res) => {
        const script = `<script type="text/javascript">
          window.PROJECT_URL = location.origin + location.pathname.replace(/\\/manage\\/view\\/?$/, '');
          window.ALLOW_SWITCH = false;
          ${appVariables(req.currentProject)}
        </script>`;
        fs.readFile(`./portal/manager/view/index.html`, 'utf8', (err, contents) => {
          res.send(contents.replace('<head>', `<head>${script}`));
        });
      });
      app.use('/project/:projectId/manage', express.static(`./portal/manager`));
    }

    // Mount the saml integration.
    app.use('/project/:projectId/saml', require('./src/saml/saml')(app.formio));

    // Mount the aggregation system.
    app.use('/project/:projectId/report', require('./src/middleware/report')(app.formio));

    // Allow changing the owner of a project
    app.use('/project/:projectId/owner', require('./src/middleware/projectOwner')(app.formio));

    // Add remote token generation endpoint.
    app.use('/project/:projectId/access/remote', require('./src/middleware/remoteAccess')(app.formio));

    // Mount the error logging middleware.
    app.use(Logger.middleware);

    app.storage = require('./src/storage/index.js')(app);

    // Check to install primary project.
    require('./src/util/install')(app, config, () => {
      return q.resolve({
        app: app,
        config: config
      });
    });
  });

  // Do some logging on uncaught exceptions in the application.
  process.on('uncaughtException', function(err) {
    if (config.jslogger && jslogger) {
      /* eslint-disable no-console */
      console.log('Uncaught exception:');
      console.log(err);
      console.log(err.stack);
      /* eslint-enable no-console */

      jslogger.log({
        message: err.stack || err.message,
        fileName: err.fileName,
        lineNumber: err.lineNumber
      });
    }

    if (Logger.middleware) {
      Logger.middleware(err, {});
    }

    // Give the loggers some time to log before exiting.
    setTimeout(function() {
      process.exit(1);
    }, 2500);
  });

  return q.promise;
};
