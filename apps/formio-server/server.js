'use strict';

require('dotenv').load({silent: true});
var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var packageJson = require('./package.json');
var Q = require('q');
var debug = require('debug')('formio:requestInfo');
var cacheControl = require('express-cache-controller');

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
  const RedisInterface = require('./src/util/redis');
  const redis = new RedisInterface(config);

  // Load the analytics hooks.
  const analytics = require('./src/analytics/index')(redis);

  var Logger = require('./src/logger/index')(config);

  // Ensure that we create projects within the helper.
  app.hasProjects = true;

  // Create the app server.
  app.server = require('http').createServer(app);
  app.listen = function() {
    return app.server.listen.apply(app.server, arguments);
  };

  // Make sure no-cache headers are sent to prevent IE from caching Ajax requests.
  app.use(cacheControl({
    noCache: true
  }));

  // Debug request info.
  app.use(function(req, res, next) {
    debug(req.method + ': ' + req.originalUrl);
    next();
  });

  // Hook each request and add analytics support.
  app.use(analytics.hook);

  app.use(favicon('./favicon.ico'));

  // Add Middleware necessary for REST API's
  app.use(bodyParser.urlencoded({extended: true, limit: '16mb'}));
  app.use(bodyParser.json({limit: '16mb'}));
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

  // Make sure to redirect all http requests to https.
  app.use(function(req, res, next) {
    if (!config.https || req.secure || (req.get('X-Forwarded-Proto') === 'https') || req.url === '/health') {
      return next();
    }

    res.redirect('https://' + req.get('Host') + req.url);
  });

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

  // Status response.
  app.get('/status', (req, res) => {
    res.json({
      version: packageJson.version,
      schema: packageJson.schema
    });
  });

  // Handle our API Keys.
  app.use(require('./src/middleware/apiKey')(app.formio.formio));

  // Download a submission pdf.
  let downloadPDF = [
    require('./src/middleware/aliasToken')(app),
    app.formio.formio.middleware.tokenHandler,
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

  app.modules = require('./src/modules/modules')(app, config);
  var hooks = _.merge(require('./src/hooks/settings')(app), options.hooks);

  // Start the api server.
  app.formio.init(hooks).then(function(formio) {
    app.formio.formio.cache = _.assign(app.formio.formio.cache, require('./src/cache/cache')(formio));

    // The formio app sanity endpoint.
    app.get('/health', require('./src/middleware/health')(app.formio.formio), formio.update.sanityCheck);

    // Respond with default server information.
    app.get('/', require('./src/middleware/projectIndex')(app.formio.formio));

    // Don't allow accessing a project's forms and other if it is remote. Redirect to the remote instead.
    app.use('/project/:projectId', require('./src/middleware/remoteRedirect')(app.formio));

    // Mount formio at /project/:projectId.
    app.use('/project/:projectId', app.formio);

    // Mount the aggregation system.
    app.use('/project/:projectId/report', require('./src/middleware/report')(app.formio));

    // Allow changing the owner of a project
    app.use('/project/:projectId/owner', require('./src/middleware/projectOwner')(app.formio));

    // Add remote token generation endpoint.
    app.use('/project/:projectId/access/remote', require('./src/middleware/remoteAccess')(app.formio));

    // Mount the error logging middleware.
    app.use(Logger.middleware);

    app.storage = require('./src/storage/index.js')(app);

    return q.resolve({
      app: app,
      config: config
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
